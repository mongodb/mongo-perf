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

/**
 * A utility for capturing the arguments to the Mongo.prototype.runCommand() and benchRun()
 * functions and writing them as a JSON config file that can later be run by the mongoebench binary.
 *
 * It expects to have its methods called in the following order:
 *
 *   beginPre() --> beginOps() --> beginPost() --> done()
 *
 * @param {string} testName - The name of the test case to run. The test case's name is
 *                            automatically converted into the basename of the JSON config file.
 *
 * @param {Object} options
 * @param {string} options.directory - The directory of where to save the JSON config file.
 */
function CommandTracer(testName, options) {
    var State = {
        init: "init",
        runningPre: "running pre() function",
        runningOps: "running benchRun ops",
        runningPost: "running post() function",
        done: "done",
    };

    TestData = TestData || {};
    var testDataDisableImplicitSessionsOriginal = TestData.disableImplicitSessions;
    var mongoRunCommandOriginal = Mongo.prototype.runCommand;
    var benchRunOriginal = benchRun;

    var pre = [];
    var ops;
    var post = [];
    var state = State.init;

    function assertState(expectedState) {
        if (state !== expectedState) {
            throw new Error("Expected state to be '" + expectedState + "' but was '" + state + "'");
        }
    }

    function overrideRunCommandWithSpy(commandObjArr) {
        // We disable implicit sessions to avoid having the mongo shell automatically specify a
        // logical session id in all command requests. After the changes from SERVER-35180, the
        // "lsid" field in the operations being run by mongoebench via DBDirectClient is no longer
        // silently ignored.
        TestData.disableImplicitSessions = true;

        // We skip sending the command to the server to speed up generating the JSON config files.
        Mongo.prototype.runCommand = function runCommandSpy(dbName, commandObj, options) {
            if (commandObj.hasOwnProperty("lsid")) {
                throw new Error("Cowardly refusing to generate a config file for " + testName +
                                " because it requires the use of sessions");
            }

            commandObjArr.push({op: "command", ns: dbName, command: commandObj});
            return {ok: 1};
        };
    }

    function restoreOriginalRunCommand() {
        TestData.disableImplicitSessions = testDataDisableImplicitSessionsOriginal;
        Mongo.prototype.runCommand = mongoRunCommandOriginal;
    }

    this.beginPre = function beginPre() {
        assertState(State.init);
        state = State.runningPre;

        overrideRunCommandWithSpy(pre);
    };

    this.beginOps = function beginOps() {
        assertState(State.runningPre);
        state = State.runningOps;

        restoreOriginalRunCommand();

        // We skip running the workload to speed up generating the JSON config files.
        benchRun = function benchRunSpy(benchArgs) {
            ops = benchArgs.ops;
            return {"totalOps/s": 0, errCount: NumberLong(0)};
        }
    };

    this.beginPost = function beginPost() {
        assertState(State.runningOps);
        state = State.runningPost;

        benchRun = benchRunOriginal;
        overrideRunCommandWithSpy(post);
    };

    this.done = function done() {
        assertState(State.runningPost);
        state = State.done;

        restoreOriginalRunCommand();

        // The contents of the post() function are really things we'd want to run before the test
        // case. It's possible that we'll end up duplicating the cleanup by putting them before the
        // contents of the pre() function.
        pre = post.concat(pre);

        // Some test cases cannot be written out as a JSON file because they insert very large
        // documents that when combined together into an array of operations exceeds the maximum
        // BSON document size limit.
        var config;
        try {
            // We first try to use prettyPrint=true so the config file has the possibility of being
            // more readable for humans. The 16MB document size limit applies to arguments of
            // JavaScript functions implemented in C++ (because they are converted to BSON) so all
            // the additional whitespace can unnecessarily put us over the limit.
            //
            // We also call Object.bsonsize() on the JavaScript object itself to see if we shouldn't
            // spend any time serializing it to JSON because the resulting BSON document would be
            // over the 16MB size limit.
            Object.bsonsize({pre: pre, ops: ops});

            var prettyPrint = true;
            try {
                config = tostrictjson({pre: pre, ops: ops}, prettyPrint);
                Object.bsonsize({_: config});
            } catch (e) {
                prettyPrint = false;
                config = tostrictjson({pre: pre, ops: ops}, prettyPrint);
                Object.bsonsize({_: config});
            }
        } catch (e) {
            print("Skipping " + testName + " because it results in a config file larger than 16MB" +
                  " and therefore cannot be deserialized as a single BSON document: " + e.message);
            return;
        }

        // We convert the test name from its upper camel case form to a snake case form by making a
        // similar set of substitutions to what https://stackoverflow.com/a/1176023 describes.
        var basename = testName.replace(/\./g, "_");
        basename = basename.replace(/(.)([A-Z][a-z]+)/g, function(match, p1, p2) {
            return p1 + "_" + p2;
        });
        basename = basename.replace(/([a-z0-9])([A-Z])/g, function (match, p1, p2) {
            return p1 + "_" + p2;
        });
        basename = basename.replace(/_+/g, "_");
        basename = basename.toLowerCase();

        var directory = options.directory || "./mongoebench";
        var filename = directory + "/" + basename + ".json";
        var fileExisted = removeFile(filename);

        var prefix = fileExisted ? "Regenerating" : "Generating";
        print(prefix + " config file for " + testName + " as " + filename);

        writeFile(filename, config);
    }
}

var sharedCollections = [];
function initCollections(collections, env, testName, init, multidb, multicoll, shard) {
    for (var i = 0; i < multidb; i++) {
        var sibling_db = db.getSiblingDB('test' + i);
        var foo = testName.replace(/\./g, "_");
        for (var j = 0; j < multicoll; j++) {
            var coll = sibling_db.getCollection(foo + j);
            collections.push(coll);
            coll.drop();
        }
    }

    if (init) {
        for (var i = 0; i < (multidb * multicoll); i++) {
            init(collections[i], env);
        }
    }

    // If the 'dataGen' or 'pre' functions did not create the collections, then we should
    // explicitly do so now. We want the collections to be pre-allocated so that allocation time is
    // not incorporated into the benchmark.
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
                collections[(multicoll * i) + j].createIndex({ _id: "hashed" });
            }

            sh.enableSharding("test" + i);
            for (var j = 0; j < multicoll; j++) {
                var t = sh.shardCollection("test" + i + "." +
                    collections[(multicoll * i) + j].getName(), { _id: "hashed" });
            }

        } else if (shard == 2) {
            sh.enableSharding("test" + i);
            for (var j = 0; j < multicoll; j++) {
                var t = sh.shardCollection("test" + i + "." +
                    collections[(multicoll * i) + j].getName(), { _id: 1 });
            }
        }
    }
}

function cleanupCollections(collections, multidb, multicoll) {
    for (var i = 0; i < multidb; i++) {
        for (var j = 0; j < multicoll; j++) {
            collections[(multicoll * i) + j].drop();
        }
    }

    // Make sure all collections have been dropped
    checkForDroppedCollectionsTestDBs(db, multidb)
}

function runTest(
    test, thread, multidb, multicoll, runSeconds, shard, crudOptions, printArgs, shareDataset,
    mongoeBenchOptions, username, password) {

    if (typeof crudOptions === "undefined") crudOptions = getDefaultCrudOptions();
    if (typeof shard === "undefined") shard = 0;
    if (typeof includeFilter === "undefined") includeFilter = "sanity";
    if (typeof printArgs === "undefined") printArgs = false;

    var realTracer = new CommandTracer(test.name, mongoeBenchOptions);
    var fakeTracer = {};
    Object.keys(realTracer).forEach(function(methodName) {
        // We copy all the properties defined on 'realTracer' as no-op functions.
        fakeTracer[methodName] = Function.prototype;
    });

    var tracer = mongoeBenchOptions.traceOnly ? realTracer : fakeTracer;
    tracer.beginPre();

    // setup an environment to pass to the pre and post
    var env = {
        threads: thread
    };

    var collections = shareDataset ? sharedCollections : [];
    // For sharing of collections' data between tests in the same suite, the tests MUST provide
    // 'generateData' function that is executed once (from the test that happens to run first). The
    // tests MIGHT also provide 'pre' and 'post' fixtures to create indexes, etc. These functions are
    // exectuted per test. The matter is complicated by the fact that existing tests use 'pre' for
    // creating the data and setting up the additional stuff, and we don't want to modify these
    // tests. On the other hand, the future tests might want to use both 'generateData' and 'pre'
    // without sharing the dataset.
    if ("generateData" in test) {
        if (!shareDataset || collections.length == 0) {
            initCollections(collections, env, test.name, test.generateData, multidb, multicoll, shard);
        }
        if ("pre" in test) {
            for (var i = 0; i < (multidb * multicoll); i++) {
                test.pre(collections[i], env);
            }
        }
    }
    else {
        assert(!shareDataset);
        initCollections(collections, env, test.name, test.pre, multidb, multicoll, shard);
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

    tracer.beginOps();

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

    tracer.beginPost();

    if ("post" in test) {
        for (var i = 0; i < multidb; i++) {
            for (var j = 0; j < multicoll; j++) {
                test.post(collections[(multicoll * i) + j], env);
            }
        }
    }

    tracer.done();

    // drop all the collections created by this case
    if (!shareDataset) {
        cleanupCollections(collections);
    }

    return { ops_per_sec: total, error_count : result["errCount"]};
}

function getMean(values) {
    var sum = 0;
    for (var j = 0; j < values.length; j++) {
        sum += values[j];
    }
    return sum / values.length;
}

function getNFieldNames(numFields) {
    var fieldNames = [];
    for (var i = 0; i < numFields; i++) {
        fieldNames.push("field-" + i);
    }
    return fieldNames;
}

/**
 * Inserts value at the location specified by path (using dot notation) in object.
 * If there's a common non-object field name this function overwrites the previous values.
 */
function setDottedFieldToValue(object, path, value) {
    assert(typeof path === "string");

    var pathAsArray = path.split(".");
    setFieldPathArrayToValue(object, pathAsArray, value);

    return object;
}

function setFieldPathArrayToValue(object, pathAsArray, value) {
    if (pathAsArray.length == 1) {
        object[pathAsArray[0]] = value;
    } else {
        if (typeof(object[pathAsArray[0]]) !== "object") {
            object[pathAsArray[0]] = {};
        }
        var subObject = object[pathAsArray[0]];
        pathAsArray.shift();
        setFieldPathArrayToValue(subObject, pathAsArray, value);
    }
}

function getDefaultCrudOptions() {
    var crudOptions = {};
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

/*
 * Check to see if this test should run against current version of the server. Tests may be
 * annotated with a MINVERSION-N.M tag, to indicate that the test should only be run if the server
 * version is greated than or equal to N.M. Note the tag can have 1 to 3 elements to the version
 * string. If it only has 1 element, the comparison will stop after the major version comparison.
*/
function doVersionExclude(test) {
    var tags = test.tags;
    for (var i = 0; i < tags.length; i++) {
        var tag = tags[i];
        if (tag.indexOf(">=") == 0)
        {
            // Check the tags.
            if (db.version() === "0.0.0") {
                print("Skipping server version check for unversioned binary");
                return false;
            }

            var serverVersion = db.version().split(".");
            var minVersion = tag.split("=")[1].split(".");
            for (var j = 0; j < minVersion.length; j++) {
                if (toInt(serverVersion[j]) < toInt(minVersion[j])) {
                    print("Skipping test " + test.name
                          + ". Server does not meet minimum required version: "
                          + db.version() + " < " + tag.split("=")[1]);
                    return true;
                }
                // Don't check minor version if major is above the threshold.
                if (toInt(serverVersion[j]) > toInt(minVersion[j]))
                    break;
            }
        }
    }
    return false;
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
    // Can this test run against this version of the shell?
    if (doVersionExclude(test)) {
        return false;
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
function runTests(
    threadCounts, multidb, multicoll, seconds, trials, includeFilter, excludeFilter, shard,
    crudOptions, excludeTestbed, printArgs, shareDataset, mongoeBenchOptions, username, password) {

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

    // Save storage engine information
    testResults['storageEngine'] = db.runCommand("serverStatus").storageEngine.name;

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
                        results[j] = runTest(
                            test, threadCount, multidb, multicoll, seconds, shard, crudOptions,
                            printArgs, shareDataset, mongoeBenchOptions, username, password);
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
function mongoPerfRunTests(
    threadCounts, multidb, multicoll, seconds, trials, includeFilter, excludeFilter, shard,
    crudOptions, excludeTestbed, printArgs, shareDataset, mongoeBenchOptions, username, password) {
    testResults = runTests(
        threadCounts, multidb, multicoll, seconds, trials, includeFilter, excludeFilter, shard,
        crudOptions, excludeTestbed, printArgs, shareDataset, mongoeBenchOptions, username, password);
    print("@@@RESULTS_START@@@");
    print(JSON.stringify(testResults));
    print("@@@RESULTS_END@@@");
}

// Document generation functions

/**
 * Helper function to generate documents in the collection using the
 * generator function to generate the documents
 */
function generateDocs(nDocs, generator) {
    return function(collection) {
        collection.drop();
        docs = [];
        for (var i = 0; i < nDocs; i++) {
          docs.push(generator(i));
        }
        collection.insert(docs, {'ordered': false});
    };
 }

/**
 * Generates simple docs with increasing x value
 */
function increasingXGenerator() {
    var x = 0;
    return function(i) {
        var doc = {_id: i, "x": x};
        x++;
        return doc;
    };
}

/**
 * Generates documents of the form {x: i, y: j}
 * with increasing values for x and y
 * y will cycle from 0 to numY.
 */
function tupleGenerator(numY) {
    var x = 0;
    var y = 0;
    return function(i) {
        var doc = {_id: i, "x": x, "y": y};
        if (y++ > numY) {
            y = 0;
            x++;
        }
        return doc;
    };
}

/**
 * Generates documents containing 4-letter strings
 */
function permutationGenerator() {
    var strings = [];
    for (var i = 0; i < 26; i++) {
        strings.push(String.fromCharCode(97 + i));
    }
    var i = 0;
    var j = 0;
    var k = 0;
    var l = 0;
    return function(i) {
        var doc = {_id: i, x: strings[i] + strings[j] + strings[k] + strings[l]};
        if (++l > 25) {
            l = 0;
            if (++k > 25) {
                k = 0;
                if (++j > 25) {
                    j = 0;
                    if (++i > 25) {
                        i = 0;
                    }
                }
            }
        }
        return doc;
    };
}

/**
 * Generates deeply nested documents
 */
function nestedGenerator(big) {
    var strings = [];
    for (var i = 0; i < 26; i++) {
        strings.push(String.fromCharCode(97 + i));
    }
    var i = 0;
    var levelSize = big ? 26 : 13;
    return function(id) {
        doc = {_id: id};
        for (var j = 0; j < levelSize; j++) {
            doc[strings[j]] = {};
            for (var k = 0; k < levelSize; k++) {
                doc[strings[j]][strings[k]] = {};
                for (var l = 0; l < levelSize; l++) {
                    doc[strings[j]][strings[k]][strings[l]] = {};
                    for (var m = 0; m < levelSize; m++) {
                        doc[strings[j]][strings[k]][strings[l]][strings[m]] = i + j + k + l + m;
                    }
                }
            }
        }
        i++;
        return doc;
    };
}

/**
 * Rewrites a query op in benchRun format to the equivalent aggregation command op, also in
 * benchRun format.
 */
function rewriteQueryOpAsAgg(op) {
    var newOp = {
        op: "command",
        ns: "#B_DB",
        command: {
            aggregate: "#B_COLL",
            pipeline: [],
            cursor: {}
        }
    };
    var pipeline = newOp.command.pipeline;

    if (op.query) {
        pipeline.push({ $match: op.query });
    }
    if (op.sort) {
        pipeline.push({ $sort: op.sort });
    }

    if (op.skip) {
        pipeline.push({ $skip: op.skip });
    }

    if (op.limit) {
        pipeline.push({ $limit: op.limit });
    } else if (op.op === "findOne") {
        pipeline.push({ $limit: 1 });
    }

    // Confusingly, benchRun uses the name "filter" to refer to the projection (*not* the query
    // predicate).
    if (op.filter) {
        pipeline.push({ $project: op.filter });
    }

    return newOp;
}

/**
 * Sets up a collection and/or a view with the appropriate documents and indexes.
 *
 * @param {Boolean} isView - True if 'collectionOrView' is a view; false otherwise.
 * @param {Number} nDocs - The number of documents to insert into the collection.
 * @param {function} docGenerator - A function that takes a document number and returns a
 * document.
 * @param {Object[]} indexes - A list of index specs to create on the collection.
 * @param {Object} collectionOptions - Options to use for view/collection creation.
 */
function collectionPopulator(isView, nDocs, indexes, docGenerator, collectionOptions) {
    return function(collectionOrView) {
        Random.setRandomSeed(258);

        collectionOrView.drop();

        var db = collectionOrView.getDB();
        var collection;
        if (isView) {
            // 'collectionOrView' is a view, so specify a backing collection to serve as its
            // source and perform the view creation.
            var viewName = collectionOrView.getName();
            var collectionName = viewName + "_BackingCollection";
            collection = db.getCollection(collectionName);
            collection.drop();

            var viewCreationSpec = {create: viewName, viewOn: collectionName};
            assert.commandWorked(
                db.runCommand(Object.extend(viewCreationSpec, collectionOptions)));
        } else {
            collection = collectionOrView;
        }

        var collectionCreationSpec = {create: collection.getName()};
        assert.commandWorked(
            db.runCommand(Object.extend(collectionCreationSpec, collectionOptions)));
        var bulkOp = collection.initializeUnorderedBulkOp();
        for (var i = 0; i < nDocs; i++) {
            bulkOp.insert(docGenerator(i));
        }
        bulkOp.execute();
        indexes.forEach(function(indexSpec) {
            assert.commandWorked(collection.createIndex(indexSpec));
        });
    };
}

/**
 * Creates test cases and adds them to the global testing array. By default, each test case
 * specification produces several test cases:
 *  - A find on a regular collection.
 *  - A find on an identity view.
 *  - The equivalent aggregation operation on a regular collection.
 *
 * @param {Object} options - Options describing the test case.
 * @param {String} options.name - The name of the test case. "Queries" is prepended for tests on
 * regular collections and "Queries.IdentityView" for tests on views.
 * @param {function} options.docs - A generator function that produces documents to insert into
 * the collection.
 * @param {Object[]} options.op - The operations to perform in benchRun.
 *
 * @param {Boolean} {options.createViewsPassthrough=true} - If false, specifies that a views
 * passthrough test should not be created, generating only one test on a regular collection.
 * @param {Boolean} {options.createAggregationTest=true} - If false, specifies that an
 * aggregation test should not be created.
 * @param {Object[]} {options.indexes=[]} - An array of index specifications to create on the
 * collection.
 * @param {String[]} {options.tags=[]} - Additional tags describing this test. The "query" tag
 * is automatically added to test cases for collections. The tags "views" and
 * "query_identityview" are added to test cases for views.
 * @param {Object} {options.collectionOptions={}} - Options to use for view/collection creation.
 */
function addQueryTestCase(options) {
    var isView = true;
    var indexes = options.indexes || [];
    var tags = options.tags || [];

    tests.push({
        tags: ["query"].concat(tags),
        name: "Queries." + options.name,
        pre: collectionPopulator(
            !isView, options.nDocs, indexes, options.docs, options.collectionOptions),
        post: function(collection) {
            collection.drop();
        },
        ops: [options.op]
    });

    if (options.createViewsPassthrough !== false) {
        tests.push({
            tags: ["views", "query_identityview"].concat(tags),
            name: "Queries.IdentityView." + options.name,
            pre: collectionPopulator(
                isView, options.nDocs, indexes, options.docs, options.collectionOptions),
            post: function(view) {
                view.drop();
                var collName = view.getName() + "_BackingCollection";
                view.getDB().getCollection(collName).drop();
            },
            ops: [options.op]
        });
    }

    if (options.createAggregationTest !== false) {
        // Generate a test which is the aggregation equivalent of this find operation.
        tests.push({
            tags: ["agg_query_comparison"].concat(tags),
            name: "Aggregation." + options.name,
            pre: collectionPopulator(
                !isView, options.nDocs, indexes, options.docs, options.collectionOptions),
            post: function(collection) {
                collection.drop();
            },
            ops: [rewriteQueryOpAsAgg(options.op)]
        });
    }
}
