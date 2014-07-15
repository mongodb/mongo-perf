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

    // call the built-in function
    var benchArgs = { ops:      new_ops,
                      seconds:  runSeconds,
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

    var total_old =
        result["insert_old"] +
        result["query_old"] +
        result["update_old"] +
        result["delete_old"] +
        result["getmore_old"] +
        result["command_old"];

    if ("post" in test) {
        for (var i = 0; i < multidb; i++) {
            test.post(collections[i]);
        }
    }

    return { ops_per_sec: total, ops_per_sec_old: total_old };
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

/*
function getVariance2( numericArray ) {
    var sumX = 0;
    var sumXX = 0;

    var len = numericArray.length;
    while (len--) {
        sumX += numericArray[len];
        sumXX += numericArray[len] * numericArray[len];
    }
    // not as accurate as two-pass algorithm above
    return ( sumXX - sumX * sumX / numericArray.length ) / numericArray.length;
}
*/

<<<<<<< HEAD
function getMean( values ) {
    var sum = 0.0;
    for (var j=0; j < values.length; j++) {
         sum += values[j];
    }
    return sum / values.length;
}

function runTests(threadCounts, multidb, seconds, trials, reportLabel, reportHost, reportPort, commitDate) {
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
            commit:      bi.gitVersion,
            label:       reportLabel,
            platform:    bi.sysInfo.split(" ")[0],
            run_date:    formatRunDate(now),
            run_time:    now,
            commit_date: new Date(commitDate * 1000),
            version:     bi.version
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
            for (var j=0; j < trials; j++) {
                results[j] = runTest(test, threadCount, multidb, seconds);
            }
            var values = []
            var values_old = []
            for (var j=0; j < trials; j++) {
                values[j] = results[j].ops_per_sec
                values_old[j] = results[j].ops_per_sec_old
            }
            var mean = getMean(values);
            var mean_old = getMean(values_old);
            var variance_old = getVariance(values_old);
            print("old_stddev: " + Math.sqrt(variance_old));
            var variance = getVariance(values);
            print("new_stddev: " + Math.sqrt(variance));
            var newResults = {}
            newResults.ops_per_sec = values;
            newResults.ops_per_sec_old = values_old;
            newResults.mean_ops_per_sec = mean;
            newResults.mean_ops_per_sec_old = mean_old;
            newResults.variance = variance;
            newResults.variance_old = variance_old;
            newResults.standardDeviation = Math.sqrt(variance);
            newResults.standardDeviation_old = Math.sqrt(variance_old);
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
