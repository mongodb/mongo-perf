function prepOp(collection, op) {

    function fixString( str ) {
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


function runTest(test, thread, multidb, runSeconds) {
    var writeOptions = {}
    writeOptions.safeGLE = false;
    writeOptions.writeConcernW = 0;
    writeOptions.writeConcernJ = false;
    writeOptions.writeCmd = false;
    shard = 0;

    return runTest2(test, thread, multidb, shard, runSeconds, writeOptions);
}

function runTest2(test, thread, multidb, shard, runSeconds, testBed, writeOptions) {
    var collections = [];


    for (var i = 0; i < multidb; i++) {
        var sibling_db = db.getSiblingDB('test' + i);
        var foo = test.name.replace(".", "_");
        var coll = sibling_db.getCollection(foo);
        collections.push(coll);
        coll.drop();
    }

    var new_ops = [];

    test.ops.forEach(function(z) {
        // For loop is INSIDE for-each loop so that duplicated instructions are adjacent.
        // (& should not be factored out for that reason.)
        for (var i = 0; i < multidb; i++) {
            var op = Object.extend( {}, z, true );
            op = prepOp(collections[i], op);
            new_ops.push(op);
        }
    });

    // set write concern and write command modes
    // this doesn't make sense for all tests so
    // test cases must be defined with default values
    // so this step can make the appropriate substitution
    new_ops.forEach(function(z) {
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

        if ( shard == 1 ) {
            // when shard is enabled, we want to enable shard
            collections[i].ensureIndex( { _id: "hashed" } );

            sh.enableSharding("test" + i);
            var t = sh.shardCollection("test" + i + "." + collections[i].getName(), {_id: "hashed"});
        } else if ( shard == 2) {
            sh.enableSharding("test" + i);
            var t = sh.shardCollection("test" + i + "." + collections[i].getName(), {_id: 1});
        }
    }

    // build a json document with arguments.
    // these will become a BSONObj when we pass
    // control to the built-in mongo shell function, benchRun()
    var benchArgs = { ops:      new_ops,
                      seconds:  runSeconds,
                      host:     db.getMongo().host,
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


function getVariance( numericArray ) {
    var avg = getMean( numericArray );
    var i = numericArray.length;
    var x = 0;
 
    while( i-- ){
        x += Math.pow( (numericArray[ i ] - avg), 2 );
    }
    x /= numericArray.length;
    return x;
}

function getMean( values ) {
    var sum = 0;
    for (var j=0; j < values.length; j++) {
         sum += values[j];
    }
    return sum / values.length;
}

function runTests(threadCounts, multidb, seconds, trials, reportLabel, reportHost, reportPort) {

    var writeOptions = {}
    // write concern, write command mode
    writeOptions.safeGLE = false
    writeOptions.writeConcernW = 0
    writeOptions.writeConcernJ = false
    writeOptions.writeCmdMode = false

    var testBed = {}
    // test harness, client and server info
    testBed.harness = {}
    testBed.harness.name = "mongo-perf"
    testBed.harness.version = "unknown"
    testBed.harness.git_hash = "unknown"
    testBed.server_git_commit_date = new Date()

    return runTests2(threadCounts, multidb, seconds, trials, reportLabel, reportHost, reportPort, testBed);
}

function runTests2(threadCounts, multidb, shard, seconds, trials, reportLabel, reportHost, reportPort, writeOptions, testBed) {

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

        var basicFields = {}
        basicFields = testBed // Map
        basicFields.commit = bi.gitVersion
        basicFields.label = reportLabel
        basicFields.platform = bi.sysInfo.split(" ")[0]
        basicFields.run_date = formatRunDate(startTime)
        basicFields.run_time = startTime
        basicFields.commit_date = new Date(testBed.server_git_commit_date)
        basicFields.version = bi.version
        basicFields.writeOptions = writeOptions // Map

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

    // Run all tests in the test file.
    for (var i = 0; i < tests.length; i++) {
        var test = tests[i];
        print(test.name);

        var threadResults = {};
        for (var t = 0; t < threadCounts.length; t++) {
            var threadCount = threadCounts[t];
            var results = []
            for (var j=0; j < trials; j++) {
                results[j] = runTest2(test, threadCount, multidb, shard, seconds, testBed, writeOptions);
            }
            var values = []
            for (var j=0; j < trials; j++) {
                values[j] = results[j].ops_per_sec
            }
            var mean = getMean(values);
            var variance = getVariance(values);
            var newResults = {}
            // uncomment if one needs to save the trial values that comprise the mean
            //newResults.ops_per_sec_values = values;
            newResults.ops_per_sec = mean;
            newResults.standardDeviation = Math.sqrt(variance);
            newResults.run_end_time = new Date();
            threadResults[threadCount] = newResults;
        }
        testResults[test] = threadResults;

        if (reportLabel) {
            var resultsArr = (multidb > 1) ? "multidb" : "singledb";

            var queryDoc = { _id: myId };
            queryDoc[resultsArr + ".name"] = test.name;

            if (resultsCollection.findOne(queryDoc)) {
                var innerUpdateDoc = {};
                innerUpdateDoc[resultsArr + ".$.results"] = threadResults;
                resultsCollection.update(queryDoc, { $set: innerUpdateDoc } );
            } else {
                var innerUpdateDoc = {};
                innerUpdateDoc[resultsArr] = { name: test.name, results: threadResults };
                resultsCollection.update({ _id: myId }, { $push: innerUpdateDoc });
            }
        }
    }

    // End delimiter for the useful output to be displayed.
    print("@@@END@@@");

    return testResults;
}
