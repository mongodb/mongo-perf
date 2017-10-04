function prepOp(collection, op) {

    function fixString(str) {
        if (str.startsWith("#B_COLL")) {
            return str.replace("#B_COLL", collection.getName());
        }
        else if (str.startsWith("#B_NS")) {
            return str.replace("#B_NS", collection.getFullName());
        }
        else if (str.startsWith("#B_DB")) {
            return str.replace("#B_DB", collection.getDB().getName());
        }
        throw new Error("unknown expansion " + str);
    }

    function recurse(doc) {
        for (var key in doc) {
            var val = doc[key];
            if (typeof(val) == "string" && val.startsWith("#B_")) {
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

function checkForDroppedCollections(database){
    // Check for any collections in 'drop-pending' state. The collection name should be of the
    // format "system.drop.<optime>.<collectionName>", where 'optime' is the optime of the
    // collection drop operation, encoded as a string, and 'collectionName' is the original
    // collection name.
    var pendingDropRegex = new RegExp("system\.drop\..*\.");
    collections = database.runCommand("listCollections", {includePendingDrops: true}).cursor.firstBatch;
    collection = collections.find(function(c){pendingDropRegex.test(c.name)});
    return collection;
}

/*
 * Cast a string number to an integer, and throw an exception if it fails.
 */
function toInt(string_number){
    var number = parseInt(string_number);
    if (isNaN(number)) {
        throw "parseInt returned NaN";
    }
    return number;
}

function checkForDroppedCollectionsTestDBs(db, multidb){
    // Check for any collections in 'drop-pending' state in any test
    // database. The test databases have name testN, where N is 0 to
    // multidb - 1;

    // The checks only matter for versions 3.5 and later.
    // The shell has some issues with the checks before 3.2
    var serverVersion = db.version().split(".");
    var clientVersion = version().split(".");

    if ( toInt(serverVersion[0]) < 3 || (toInt(serverVersion[0]) == 3 && toInt(serverVersion[1]) < 5 )) {
        return;
    }
    if ( toInt(clientVersion[0]) < 3 || (toInt(clientVersion[0]) == 3 && toInt(clientVersion[1]) < 2 )) {
        return;
    }
    for (var i = 0; i < multidb; i++) {
        var sibling_db = db.getSiblingDB('test' + i);
        var retries = 0;
        while (checkForDroppedCollections(sibling_db) && retries < 1000) {
            print("Sleeping 1 second while waiting for collection to finish dropping")
            retries += 1;
            sleep(1000);
        }
        assert(retries < 1000, "Timeout on waiting for collections to drop");
    }
}

function runTest(test, thread, multidb, multicoll, runSeconds, shard, crudOptions, printArgs, username, password) {

    if (typeof crudOptions === "undefined") crudOptions = getDefaultCrudOptions();
    if (typeof shard === "undefined") shard = 0;
    if (typeof includeFilter === "undefined") includeFilter = "sanity";
    if (typeof printArgs === "undefined") printArgs = false;

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

    // set crud options
    new_ops.forEach(function (z) {
        //  when true, safe mode calls GLE after every op
        z.safe = (crudOptions.safeGLE.toLowerCase() == 'true' ? true : false)
        //  w write concern (integer)
        z.writeConcern = crudOptions.writeConcern
        if (typeof(z.writeConcern.j) == "string") {
            z.writeConcern.j = (z.writeConcern.j.toLowerCase() == 'true' ? true : false)
        }
        //  use write commands in lieu of legacy update, remove or insert ops
        //  note: only one op will be in the array
        z.writeCmd = (crudOptions.writeCmdMode.toLowerCase() == 'true' ? true : false)
        //  same as 'writeCmd', but for read commands
        z.readCmd = (crudOptions.readCmdMode.toLowerCase() == 'true' ? true : false)
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
    if (username) {
        benchArgs["username"] = username;
        benchArgs["password"] = password;
    }

    if (printArgs) {
        print(JSON.stringify(benchArgs));
    }

    // Make sure the system is queisced
    // Check for dropped collections
    checkForDroppedCollectionsTestDBs(db, multidb)
    db.adminCommand({fsync: 1});


    // invoke the built-in mongo shell function
    var result = benchRun(benchArgs);

    var total;
    if ("totalOps/s" in result) {
        total = result["totalOps/s"];
    }
    else {
        total =
            result["insert"] +
            result["query"] +
            result["update"] +
            result["delete"] +
            result["getmore"] +
            result["command"];
    }
    error_string = "";
    if (result["errCount"] != 0)
        error_string = "There were errors: " + result["errCount"];
    print("\t" + thread + "\t" + total + "\t" + error_string);

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

    // Make sure all collections have been dropped
    checkForDroppedCollectionsTestDBs(db, multidb)

    return { ops_per_sec: total, error_count : result["errCount"]};
}

function getMean(values) {
    var sum = 0;
    for (var j = 0; j < values.length; j++) {
        sum += values[j];
    }
    return sum / values.length;
}

function getDefaultCrudOptions() {
    var crudOptions = {};
    crudOptions.safeGLE = 'false';
    crudOptions.writeConcern = {};
    crudOptions.writeCmdMode = 'true';
    crudOptions.readCmdMode = 'false';
    return crudOptions;
}

function doCompare(test, compareTo) {
    var tags = test.tags;

    if ( Array.isArray(compareTo) ) {
        for (var i = 0;i < compareTo.length; i++) {
            if ( tags.indexOf(compareTo[i]) > -1 || test.name == compareTo[i]) {
                return true;
            }
        }
        return false;
    }
    else {
        if ( tags.indexOf(compareTo) > -1 || test.name == compareTo) {
            return true;
        }
    }
    return false;
}

function doCompareExclude(test, compareTo) {
    var tags = test.tags;

    if ( Array.isArray(compareTo) ) {
        for (var i = 0;i < compareTo.length; i++) {
            if (!( tags.indexOf(compareTo[i]) > -1 || test.name == compareTo[i])) {
                return false;
            }
        }
        return true;
    }
    else {
        if ( tags.indexOf(compareTo) > -1 || test.name == compareTo) {
            return false;
        }
    }
    return true;
}

function doExecute(test, includeFilter, excludeFilter) {

    var include = false;
    // Use % to indicate all tests
    if ( !Array.isArray(includeFilter) ) {
        if ( includeFilter == "%" ) {
            include = true;
        }
    }

    // If we have a textFilter but no tags, then bail
    else if ( !Array.isArray(test.tags) ) {
        return false;
    }

    if ( !include && Array.isArray(includeFilter) ) {
        if (Array.isArray(includeFilter[0])) {
            // lists of lists of filters. Must match all lists
            for (var i=0; i < includeFilter.length; i++) {
                if (!doCompare(test, includeFilter[i])) {
                    return false;
                }
            }
            include = true;
        }
        else {
            // have the form : ['suitea', 'suiteb', 'Insert.foo' ]
            include = doCompare(test, includeFilter);
        }
    }
    if ( !include ) {
        return false;
    }
    if ( Array.isArray(excludeFilter) ) {
        if (Array.isArray(excludeFilter[0])) {
            // lists of lists of filters. Must match all lists
            for (var i=0; i < excludeFilter.length; i++) {
                if (doCompareExclude(test, excludeFilter[i])) {
                    return false;
                }
            }
        }
    }
    return true;
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
 * @param includeFilter - tests/suites to run, default "sanity"
 * @param excludeFilter - tests / suites not to run
 * @param shard - the number of shards the test is run for (defaults to 0)
 * @param crudOptions - the crudOptions to be used with the test (see getDefaultCrudOptions() for defaults)
 * @param excludeTestbed - Exclude testbed information from results
 * @returns {{}} the results of a run set of tests
 */
function runTests(threadCounts, multidb, multicoll, seconds, trials, includeFilter, excludeFilter, shard, crudOptions, excludeTestbed, printArgs, username, password) {

    if (typeof shard === "undefined") shard = 0;
    if (typeof crudOptions === "undefined") crudOptions = getDefaultCrudOptions();
    if (typeof includeFilter === "undefined") includeFilter = "sanity";
    if (typeof excludeTestbed === "undefined") excludeTestbed = false;
    if (typeof printArgs === "undefined") printArgs = false;

    var testResults = {};
    testResults.results=[];

    // Save basic testbed info if not running in evergreen
    if (!excludeTestbed) {
        var basicFields = {};
        var bi = db.runCommand("buildInfo");

        basicFields.commit = bi.gitVersion;
        if (bi.sysInfo) {
            basicFields.platform = bi.sysInfo.split(" ")[0];
        }
        else if (bi.buildEnvironment.target_os) {
            basicFields.platform = bi.buildEnvironment.target_os;
        }
        else {
            basicFields.platform = "Unknown Platform";
        }
        basicFields.version = bi.version;
        basicFields.crudOptions = crudOptions; // Map
        testResults['basicFields'] = basicFields;
    }

    print("@@@START@@@");
    testResults['start'] = new Date();

    // Run all tests in the test file.
    for (var i = 0; i < tests.length; i++) {
        var test = tests[i];
        var errors = [];
        // Execute if it has a matching tag to the suite that was passed in
        if ( doExecute(test, includeFilter, excludeFilter) ) {
            print(test.name)
            var threadResults = {};
            threadResults['start'] = new Date();
            for (var t = 0; t < threadCounts.length; t++) {
                var threadCount = threadCounts[t];
                var results = [];
                var newResults = {};
                for (var j = 0; j < trials; j++) {
                    try {
                        results[j] = runTest(test, threadCount, multidb, multicoll, seconds, shard, crudOptions, printArgs, username, password);
                    }
                    catch(err) {
                        // Error handling to catch exceptions thrown in/by js for error
                        // Not all errors from the mongo shell are put up as js exceptions
                        print("Error running test " + test.name + ": " + err.message + ":\n" + err.stack);
                        errors.push({test: test,
                                     trial: j,
                                     threadCount: threadCount,
                                     multidb: multidb,
                                     multicoll: multicoll,
                                     shard: shard,
                                     crudOptions: crudOptions,
                                     username: username,
                                     password: password,
                                     error: {message: err.message, code: err.code}})
                    }
                }
                var values = [];
                var errors = [];
                for (var j = 0; j < trials; j++) {
                    values[j] = results[j].ops_per_sec,
                    errors[j] = results[j].error_count.toNumber()
               }
                // uncomment if one needs to save the trial values that comprise the mean
                newResults.ops_per_sec_values = values;
                newResults.error_values = errors;
                newResults.ops_per_sec = getMean(values);
                threadResults[threadCount] = newResults;
            }
            threadResults['end'] = new Date();
            testResults['results'].push({
                name: test.name,
                results: threadResults
            });
        }
    }
    testResults['end'] = new Date();
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
 * @param includeFilter - tests / suites to run, default "sanity"
 * @param excludeFilter - tests / suites not to run
 * @param shard - the number of shards the test is run for (defaults to 0)
 * @param crudOptions - the crudOptions to be used with the test (see getDefaultCrudOptions() for defaults)
 * @param excludeTestbed - Exclude testbed information from results
 * @returns {{}} the results of a run set of tests
 */
function mongoPerfRunTests(threadCounts, multidb, multicoll, seconds, trials, includeFilter, excludeFilter, shard, crudOptions, excludeTestbed, printArgs, username, password) {
    testResults = runTests(threadCounts, multidb, multicoll, seconds, trials, includeFilter, excludeFilter, shard, crudOptions, excludeTestbed, printArgs, username, password);
    print("@@@RESULTS_START@@@");
    print(JSON.stringify(testResults));
    print("@@@RESULTS_END@@@");
}
