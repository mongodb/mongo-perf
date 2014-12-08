function prepOp(collection, op) {

    function fixString(str) {
        if (str == "#B_COLL") {
            return collection.getName();
        }
        if (str == "#B_NS") {
            return collection.getFullName();
        }
        if (str == "#B_DB") {
            return collection.getDB().getName();
        }
        throw "unknown expansion " + str;
    }

    function recurse(doc) {
        for (var key in doc) {
            var val = doc[key];
            if (typeof(val) == "string" && val.indexOf("#B_") == 0) {
                doc[key] = fixString(val);
            }
            else if (typeof(val) == "object") {
                recurse(val);
            }
        }
    }

    recurse(op);

    if (!op.ns) {
        if (op.command)
            op.ns = collection.getDB().getName();
        else
            op.ns = collection.getFullName();
    }

    return op;
}

var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function generateRandomString(length) {
    buf = "";
    for (i=0; i < length; i++) { buf+= possible.charAt(Math.floor(Math.random() * possible.length));; }
    return buf;
}

function formatRunDate(now) {
    function pad(dateComponent) {
        dateComponent = "" + dateComponent;
        while (dateComponent.length < 2) {
            dateComponent = "0" + dateComponent;
        }
        return dateComponent;
    }

    return (1900 + now.getYear() + "-" +
        pad(now.getMonth() + 1) + "-" +
        pad(now.getDate()));
}

function runTest(test, thread, multidb, multicoll, runSeconds, shard, writeOptions) {

    if (typeof writeOptions === "undefined") writeOptions = getDefaultWriteOptions();
    if (typeof shard === "undefined") shard = 0;
    if (typeof testFilter === "undefined") testFilter = "sanity";

    var collections = [];

    for (var i = 0; i < multidb; i++) {
        var sibling_db = db.getSiblingDB('test' + i);
        var foo = test.name.replace(/\./g,"_");
        for (var j = 0; j < multicoll; j++) {
            var coll = sibling_db.getCollection(foo + j);
            collections.push(coll);
            coll.drop();
        }
    }

    var new_ops = [];

    test.ops.forEach(function (z) {
        // For loop is INSIDE for-each loop so that duplicated instructions are adjacent.
        // (& should not be factored out for that reason.)
        for (var i = 0; i < (multidb * multicoll); i++) {
            var op = Object.extend({}, z, true);
            op = prepOp(collections[i], op);
            new_ops.push(op);
        }
    });

    // set write concern and write command modes
    new_ops.forEach(function (z) {
        //  when true, safe mode calls GLE after every op
        z.safe = (writeOptions.safeGLE.toLowerCase() == 'true' ? true : false)
        //  w write concern (integer)
        z.w = writeOptions.writeConcernW
        //  j write concern (boolean)
        z.j = (writeOptions.writeConcernJ.toLowerCase() == 'true' ? true : false)
        //  use write command in lieu of legacy update, remove or insert op
        //  note: only one op will be in the array
        z.writeCmd = (writeOptions.writeCmdMode.toLowerCase() == 'true' ? true : false)
    });

    // setup an environment to pass to the pre and post
    var env = {
        threads: thread
    };

    if ("pre" in test) {
        for (var i = 0; i < (multidb * multicoll); i++) {
            test.pre(collections[i], env);
        }
    }

    // If the 'pre' function did not create the collections, then we should
    // explicitly do so now. We want the collections to be pre-allocated so
    // that allocation time is not incorporated into the benchmark.
    for (var i = 0; i < multidb; i++) {
        var theDb = db.getSiblingDB('test' + i);
        // This will silently fail and with no side-effects if the collection
        // already exists.
        for (var j = 0; j < multicoll; j++) {
            theDb.createCollection(collections[(multicoll * i) + j].getName());
        }

        if (shard == 1) {
            for (var j = 0; j < multicoll; j++) {
                // when shard is enabled, we want to enable shard
                collections[(multicoll * i) + j].ensureIndex({ _id: "hashed" });
            }

            sh.enableSharding("test" + i);
            for (var j = 0; j < multicoll; j++) {
                var t = sh.shardCollection("test" + i + "." +
                    collections[(multicoll * i) + j].getName(), {_id: "hashed"});
            }

        } else if (shard == 2) {
            sh.enableSharding("test" + i);
            for (var j = 0; j < multicoll; j++) {
                var t = sh.shardCollection("test" + i + "." +
                    collections[(multicoll * i) + j].getName(), {_id: 1});
                }
        }
    }

    // build a json document with arguments.
    // these will become a BSONObj when we pass
    // control to the built-in mongo shell function, benchRun()
    var benchArgs = { ops: new_ops,
        seconds: runSeconds,
        host: db.getMongo().host,
        parallel: thread };

    // invoke the built-in mongo shell function
    var result = benchRun(benchArgs);

    var total =
        result["insert"] +
        result["query"] +
        result["update"] +
        result["delete"] +
        result["getmore"] +
        result["command"];

    print("\t" + thread + "\t" + total);

    if ("post" in test) {
        for (var i = 0; i < multidb; i++) {
            for (var j = 0; j < multicoll; j++) {
                test.post(collections[(multicoll * i) + j], env);
            }
        }
    }

    // drop all the collections created by this case
    for (var i = 0; i < multidb; i++) {
        for (var j = 0; j < multicoll; j++) {
            collections[(multicoll * i) + j].drop();
        }
    }

    return { ops_per_sec: total };
}

function medianCompare(x, y) {
  return x - y;
}
function getMedian(sortableNumbers) {
    var rval;
    if (sortableNumbers.length == 0)
        rval = undefined;
    else if (sortableNumbers.length == 1)
        rval = sortableNumbers[0];
    else {
        sortableNumbers.sort(medianCompare);
        var candidateIndex = Math.floor(sortableNumbers.length / 2);
        if (sortableNumbers.length % 2 != 0) {
            // we have an odd number of values.
            // select the middle value in the sorted list
            rval = sortableNumbers[candidateIndex];
        }
        else {
            // we have an even number of values
            // interpolate between the two values in the middle of the sorted list
            rval = (sortableNumbers[candidateIndex - 1] + sortableNumbers[candidateIndex] ) / 2;
        }
    }
    return rval;
}

function getVariance(numericArray) {
    var avg = getMean(numericArray);
    var i = numericArray.length;
    var x = 0;

    while (i--) {
        x += Math.pow((numericArray[ i ] - avg), 2);
    }
    x /= numericArray.length;
    return x;
}

function getMean(values) {
    var sum = 0;
    for (var j = 0; j < values.length; j++) {
        sum += values[j];
    }
    return sum / values.length;
}

function getDefaultTestBed(commitDate) {
    if (typeof commitDate === "undefined") commitDate = new Date();

    var shell_build_info = db.runCommand("buildInfo");

    var testBed = {};
    // test harness, client and server info
    testBed.client = {};
    testBed.client.name = "mongo shell";
    testBed.client.version = shell_build_info.version;
    testBed.client.git_hash = shell_build_info.gitVersion;
    testBed.harness = {};
    testBed.harness.name = "manual";
    testBed.harness.version = "unknown";
    testBed.harness.git_hash = "unknown";
    testBed.server_git_commit_date = commitDate;
    testBed.topology = "single_node";

    // get the server storageEngine
    var serverStatus = db.runCommand({serverStatus: 1});
    if (serverStatus.storageEngine !== undefined && serverStatus.storageEngine.name !== undefined) {
        testBed.server_storage_engine = serverStatus.storageEngine.name;
    }
    else {
        testBed.server_storage_engine = "mmapv0";
    }

    return testBed;
}

function getDefaultWriteOptions() {
    var writeOptions = {};
    // write concern, write command mode
    writeOptions.safeGLE = 'false';
    writeOptions.writeConcernW = 0;
    writeOptions.writeConcernJ = 'false';
    writeOptions.writeCmdMode = 'true';
    return writeOptions;
}

function doCompare(test, compareTo) {
    var tags = test.tags;
    
    if ( Array.isArray(compareTo) ) {
        for (var i=0; i < compareTo.length; i++) {
            if ( tags.indexOf(compareTo[i]) > -1 || test.name == compareTo[i]) {
                return true;
            }
        }
    }
    else {
        if ( tags.indexOf(compareTo) > -1 || test.name == compareTo) {
            return true;
        }
    }
    return false;
}

function doExecute(test, testFilter) {

    // Use % to indicate all tests
    if ( !Array.isArray(testFilter) ) {
        if ( testFilter == "%" ) {
            return true;
        }
    }
    
    // If we have a textFilter but no tags, then bail
    if ( !Array.isArray(test.tags) ) {
        return false;
    }

    if ( Array.isArray(testFilter) ) {
        // have the form : ['suitea', 'suiteb', 'Insert.foo' ]
        return doCompare(test, testFilter);
    }
    else if ( typeof testFilter == "object" ) {
        // Have the form { include: ['suitea'], exclude: ['suiteb', 'Insert.foo'] }
        var include = testFilter.include;
        var exclude = testFilter.exclude;
        
        if ( Array.isArray(exclude) && Array.isArray(include) ) {
            if ( !doCompare(test, exclude) && doCompare(test, include) ) {
                return true;
            }
            else {
                return false;
            }
        }

        if ( Array.isArray(exclude) ) {
            return !doCompare(test, exclude);
        }
        if ( Array.isArray(include) ) {
            return doCompare(test, include);
        }
    }
    else {
        // Have the form 'suitea'
        return doCompare(test, testFilter);
    }
    return false;
}

/**
 * Run tests defined in a tests array (outside of the function)
 *
 * @param threadCounts - array of threads to use
 * @param multidb - multidb (number of dbs)
 * @param multicoll - multicollection (number of collections)
 * @param seconds - the time to run each performance test for
 * @param trials - the number of trials to run
 * @param reportLabel - the label for the test run
 * @param testFilter - tests/suites to run, default "sanity"
 * @param reportHost - the hostname for the database to send the reported data to (defaults to localhost)
 * @param reportPort - the port number for the database to send the reported data to (defaults to 27017)
 * @param commitDate - the commit date/time to report (defaults to the current time/date)
 * @param shard - the number of shards the test is run for (defaults to 0)
 * @param writeOptions - the writeOptions to be used with the test (defaults to {safeGLE:false, writeConcernW:0, writeConcernJ:false, writeCmdMode: false}
 * @param testBed - testbed information such as server_storage_engine, harness, server_git_commit_date
 * @returns {{}} the results of a run set of tests
 */
function runTests(threadCounts, multidb, multicoll, seconds, trials, reportLabel, testFilter, reportHost, reportPort, commitDate, shard, writeOptions, testBed) {

    if (typeof reportHost === "undefined") reportHost = "localhost";
    if (typeof reportPort === "undefined") reportPort = "27017";
    if (typeof commitDate === "undefined") commitDate = new Date();
    if (typeof shard === "undefined") shard = 0;
    if (typeof writeOptions === "undefined") writeOptions = getDefaultWriteOptions();
    if (typeof testBed === "undefined") testBed = getDefaultTestBed(commitDate);
    if (typeof testFilter === "undefined") testFilter = "sanity";
    
    var testResults = {};
    testResults.results=[];
    // The following are only used when reportLabel is not None.
    var resultsCollection = db.getSiblingDB("bench_results").raw;
    var myId = 0;

    // If dumping the results to a remote host.
    if (reportHost !== "localhost" || reportPort !== "27017") {
        var connection = new Mongo(reportHost + ":" + reportPort);
        resultsCollection = connection.getDB("bench_results").raw;
    }

    // Set up the reporting database and the object that will hold these tests' info.
    if (reportLabel) {
        resultsCollection.ensureIndex({ label: 1 }, { unique: true });

        var startTime = new Date();
        myId = new ObjectId();
        var bi = db.runCommand("buildInfo");

        var basicFields = {};
        basicFields = testBed; // Map
        basicFields.commit = bi.gitVersion;
        basicFields.label = reportLabel;
        basicFields.platform = bi.sysInfo.split(" ")[0];
        basicFields.run_date = formatRunDate(startTime);
        basicFields.run_time = startTime;
        basicFields.commit_date = new Date(testBed.server_git_commit_date);
        basicFields.version = bi.version;
        basicFields.writeOptions = writeOptions; // Map

        var oldDoc = resultsCollection.findOne({ label: reportLabel });
        if (oldDoc) {
            myId = oldDoc._id;
            resultsCollection.update({ _id: myId }, { $set: basicFields });
        } else {
            basicFields._id = myId;
            resultsCollection.insert(basicFields);
        }
    }

    print("@@@START@@@");
    testResults['run_start_time'] = new Date();

    // Run all tests in the test file.
    for (var i = 0; i < tests.length; i++) {
        var test = tests[i];
        var errors = [];
        // Execute if it has a matching tag to the suite that was passed in
        if ( doExecute(test, testFilter) ) {
            print(test.name);

            var threadResults = {};
            threadResults['run_start_time'] = new Date();
            for (var t = 0; t < threadCounts.length; t++) {
                var threadCount = threadCounts[t];
                var results = [];
                var newResults = {};
                newResults['run_start_time'] = new Date();
                for (var j = 0; j < trials; j++) {
                    try {
                        results[j] = runTest(test, threadCount, multidb, multicoll, seconds, shard, writeOptions);
                    }
                    catch(err) {
                        // Error handling to catch exceptions thrown in/by js for error
                        // Not all errors from the mongo shell are put up as js exceptions
                        print("Error running test " + test + ": " + err.message);
                        errors.push({test: test, trial: j, threadCount: threadCount, multidb: multidb, multicoll: multicoll, shard: shard, writeOptions: writeOptions, error: {message: err.message, code: err.code}})
                    }
                }
                var values = [];
                for (var j = 0; j < trials; j++) {
                    values[j] = results[j].ops_per_sec
                }
                // uncomment if one needs to save the trial values that comprise the mean
                //newResults.ops_per_sec_values = values;
                newResults.ops_per_sec = getMean(values);
                newResults.median = getMedian(values);
                newResults.standardDeviation = Math.sqrt(getVariance(values));
                newResults.run_end_time = new Date();
                newResults.n = trials;
                newResults.elapsed_secs = seconds;  // TODO: update mongo shell to return actual elapsed time
                threadResults[threadCount] = newResults;
            }
            threadResults['run_end_time'] = new Date();
            testResults['results'].push({
                name: test.name,
                results: threadResults
            });

            if (reportLabel) {
                var resultsArr = (multidb > 1) ? "multidb" : "singledb";
                // XXX Right now the GUI doesn't discriminate between single and multicoll
                //resultsArr += (multicoll > 1) ? "-multicoll" : "-singlecoll";

                var queryDoc = { _id: myId };
                queryDoc[resultsArr + ".name"] = test.name;
                var end_time = new Date();

                if (resultsCollection.findOne(queryDoc)) {
                    var innerUpdateDoc = {};
                    innerUpdateDoc[resultsArr + ".$.results"] = threadResults;
                    innerUpdateDoc['end_time'] = end_time;
                    resultsCollection.update(queryDoc, { $set: innerUpdateDoc });
                } else {
                    var innerUpdateDoc = {};
                    innerUpdateDoc[resultsArr] = { name: test.name, results: threadResults };
                    resultsCollection.update({ _id: myId }, { $push: innerUpdateDoc, $set: {end_time: end_time } });
                }
            }
        }
    }
    testResults['run_end_time'] = new Date();
    testResults['errors'] =  errors;
    // End delimiter for the useful output to be displayed.
    print("@@@END@@@");

    return testResults;
}

/**
 * Run tests defined in a tests array (outside of the function)
 *
 * @param threadCounts - array of threads to use
 * @param multidb - multidb (number of dbs)
 * @param multicoll - multicollection (number of collections)
 * @param seconds - the time to run each performance test for
 * @param trials - the number of trials to run
 * @param reportLabel - the label for the test run
 * @param testFilter - tests / suites to run, default "sanity"
 * @param reportHost - the hostname for the database to send the reported data to (defaults to localhost)
 * @param reportPort - the port number for the database to send the reported data to (defaults to 27017)
 * @param commitDate - the commit date/time to report (defaults to the current time/date)
 * @param shard - the number of shards the test is run for (defaults to 0)
 * @param writeOptions - the writeOptions to be used with the test (defaults to {safeGLE:false, writeConcernW:0, writeConcernJ:false, writeCmdMode: false}
 * @param testBed - testbed information such as server_storage_engine, harness, server_git_commit_date
 * @returns {{}} the results of a run set of tests
 */
function mongoPerfRunTests(threadCounts, multidb, multicoll, seconds, trials, reportLabel, testFilter, reportHost, reportPort, commitDate, shard, writeOptions, testBed) {
    testResults = runTests(threadCounts, multidb, multicoll, seconds, trials, reportLabel, testFilter, reportHost, reportPort, commitDate, shard, writeOptions, testBed);
    print("@@@RESULTS_START@@@");
    print(JSON.stringify(testResults));
    print("@@@RESULTS_END@@@");
}
