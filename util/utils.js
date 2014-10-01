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


function runTest(test, thread, multidb, runSeconds, shard, testBed, writeOptions) {

    if (typeof writeOptions === "undefined") writeOptions = getDefaultWriteOptions();
    if (typeof testBed === "undefined") testBed = getDefaultTestBed();
    if (typeof shard === "undefined") shard = 0;

    var collections = [];

    for (var i = 0; i < multidb; i++) {
        var sibling_db = db.getSiblingDB('test' + i);
        var foo = test.name.replace(".", "_");
        var coll = sibling_db.getCollection(foo);
        collections.push(coll);
        coll.drop();
    }

    var new_ops = [];

    test.ops.forEach(function (z) {
        // For loop is INSIDE for-each loop so that duplicated instructions are adjacent.
        // (& should not be factored out for that reason.)
        for (var i = 0; i < multidb; i++) {
            var op = Object.extend({}, z, true);
            op = prepOp(collections[i], op);
            new_ops.push(op);
        }
    });

    // set write concern and write command modes
    // this doesn't make sense for all tests so
    // test cases must be defined with default values
    // so this step can make the appropriate substitution
    new_ops.forEach(function (z) {
        //  set safe mode to call GLE every op
        if ("safe" in z) {
            //z.safe = writeOptions.safeGLE;
        }
        //  w write concern
        if ("w" in z) {
            //z.w = writeOptions.writeConcernW;
        }
        //  j write concern (boolean)
        if ("j" in z) {
            //z.j = writeOptions.writeConcernJ;
        }
        //  use write command ILO legacy update, remove or insert op
        //  n.b. currently only one op will be in the array
        if ("writeCmd" in z) {
            //z.writeCmd = writeOptions.writeCmd;
        }
    });

    if ("pre" in test) {
        for (var i = 0; i < multidb; i++) {
            test.pre(collections[i]);
        }
    }

    // If the 'pre' function did not create the collections, then we should
    // explicitly do so now. We want the collections to be pre-allocated so
    // that allocation time is not incorporated into the benchmark.
    for (var i = 0; i < multidb; i++) {
        var theDb = db.getSiblingDB('test' + i);
        // This will silently fail and with no side-effects if the collection
        // already exists.
        theDb.createCollection(collections[i].getName());

        if (shard == 1) {
            // when shard is enabled, we want to enable shard
            collections[i].ensureIndex({ _id: "hashed" });

            sh.enableSharding("test" + i);
            var t = sh.shardCollection("test" + i + "." + collections[i].getName(), {_id: "hashed"});
        } else if (shard == 2) {
            sh.enableSharding("test" + i);
            var t = sh.shardCollection("test" + i + "." + collections[i].getName(), {_id: 1});
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
            test.post(collections[i]);
        }
    }

    // drop all the collections created by this case
    for (var i = 0; i < multidb; i++) {
        collections[i].drop();
    }

    return { ops_per_sec: total };
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

    var testBed = {};
    // test harness, client and server info
    testBed.harness = {};
    testBed.harness.name = "unknown";
    testBed.harness.version = "unknown";
    testBed.harness.git_hash = "unknown";
    testBed.server_git_commit_date = commitDate;

    // get the server storageEnigine
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
    writeOptions.safeGLE = false;
    writeOptions.writeConcernW = 0;
    writeOptions.writeConcernJ = false;
    writeOptions.writeCmdMode = false;
    return writeOptions;
}

/**
 *
 * @param threadCounts
 * @param multidb
 * @param seconds
 * @param trials
 * @param reportLabel
 * @param reportHost
 * @param reportPort
 * @param commitDate
 * @param shard
 * @param writeOptions
 * @param testBed
 * @returns {{}}
 */
function runTests(threadCounts, multidb, seconds, trials, reportLabel, reportHost, reportPort, commitDate, shard, writeOptions, testBed) {

    if (typeof reportHost === "undefined") reportHost = "localhost";
    if (typeof reportPort === "undefined") reportPort = "27017";
    if (typeof commitDate === "undefined") commitDate = new Date();
    if (typeof shard === "undefined") shard = 0;
    if (typeof writeOptions === "undefined") writeOptions = getDefaultWriteOptions();
    if (typeof testBed === "undefined") testBed = getDefaultTestBed(commitDate);

    var testResults = {};
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
        print(test.name);

        var threadResults = {};
        threadResults['run_start_time'] = new Date();
        for (var t = 0; t < threadCounts.length; t++) {
            var threadCount = threadCounts[t];
            var results = [];
            var newResults = {};
            newResults['run_start_time'] = new Date();
            for (var j = 0; j < trials; j++) {
                results[j] = runTest(test, threadCount, multidb, seconds, shard, testBed, writeOptions);
            }
            var values = [];
            for (var j = 0; j < trials; j++) {
                values[j] = results[j].ops_per_sec
            }
            var mean = getMean(values);
            var variance = getVariance(values);
            // uncomment if one needs to save the trial values that comprise the mean
            //newResults.ops_per_sec_values = values;
            newResults.ops_per_sec = mean;
            newResults.standardDeviation = Math.sqrt(variance);
            newResults.run_end_time = new Date();
            threadResults[threadCount] = newResults;
        }
        testResults[test] = threadResults;
        threadResults['run_end_time'] = new Date();

        if (reportLabel) {
            var resultsArr = (multidb > 1) ? "multidb" : "singledb";

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

    // End delimiter for the useful output to be displayed.
    print("@@@END@@@");

    return testResults;
}
