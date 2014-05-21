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

function runTest(test, thread, multidb) {
    var collections = [];

    for (var i = 0; i < multidb; i++) {
        var sibling_db = db.getSiblingDB('test' + i);
        var coll = sibling_db.foo;
        collections.push(coll);
        coll.drop();
    }

    var new_ops = [];

    test.ops.forEach(function(z) {
        // For loop is INSIDE for-each loop so that duplicated instructions are adjacent.
        // (& should not be factored out for that reason.)
        for (var i = 0; i < multidb; i++) {
            new_ops.push(prepOp(collections[i], z));
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
    }

    // new approach runs for 1 second and counts ops, but does this repeatedly to characterize second-to-second variance
    var benchArgs = { ops:      new_ops,
                      seconds:  1,
                      host:     db.getMongo().host,
                      parallel: thread };

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
    var sum = 0.0;
    for (var j=0; j < values.length; j++) {
         sum += values[j];
    }
    return sum / values.length;
}

function runTests(threadCounts, multidb, reportLabel, reportHost, reportPort) {
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

        var now = new Date();
        myId = new ObjectId();
        var bi = db.runCommand("buildInfo");
        var basicFields = {
            commit:     bi.gitVersion,
            label:      reportLabel,
            platform:   bi.sysInfo.split(" ")[0],
            run_date:   formatRunDate(now),
            run_time:   now,
            version:    bi.version
        };

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
            for (var j=0; j < 30; j++) {
                results[j] = runTest(test, threadCount, multidb);
            }
            var values = []
            for (var j=0; j < 30; j++) {
                values[j] = results[j].ops_per_sec
            }
            var mean = getMean(values);
            var variance = getVariance(values, 13);  // 13 digits of precision
            var newResults = {}
            newResults.ops_per_sec = values;
            newResults.mean_ops_per_sec = mean;
            newResults.variance = variance;
            newResults.standardDeviation = Math.sqrt(variance);
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
