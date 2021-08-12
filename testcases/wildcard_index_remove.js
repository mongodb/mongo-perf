if ((typeof tests === "undefined" ? "undefined" : typeof(tests)) != "object") {
    tests = [];
}

(function () {
    'use strict';
    /**
     * Creates test cases and adds them to the global testing array.
     *
     * @param {Object} options - Options describing the test case.
     * @param {String} options.name - The name of the test case.
     * @param {Object[]} options.ops - The operations to perform in benchRun.
     * @param {function} options.pre - A function that sets up for the test case.
     * @param {String[]} options.tags - Additional tags describing this test.
     */
    function addRemoveTest(options) {
        tests.push({
            name: "Remove.WildcardIndex." + options.name,
            tags: ["wildcard_write", "indexed", ">=4.1.3"].concat(options.tags),
            pre: options.pre,
            ops: options.ops
        });
    }

    function populateCollection(docGenerator, collection, count) {
        for (var i = 0; i < count; ++i) {
            assert.writeOK(collection.insert(docGenerator(i)));
        }
    }

    /**
     * Populates a collection with test data and creates a regular sparse index. This collection is
     * used for comparison testing against the same data set with a $** index.
     */
    function getSetupFunctionForTargetedIndex(fieldsToIndex, documentGenerator, documentCount) {
        return function(collection) {
            collection.drop();
            populateCollection(documentGenerator, collection, documentCount);

            for (var i = 0; i < fieldsToIndex.length; ++i) {
                var indexSpec = {};
                indexSpec[fieldsToIndex[i]] = 1;
                assert.commandWorked(collection.createIndex(indexSpec, {sparse: true}));
            }
        };
    }

    /**
     * Populates a collection with test data and creates a $** index.
     */
    function getSetupFunctionWithWildcardIndex(fieldsToIndex, documentGenerator, documentCount) {
        return function(collection) {
            collection.drop();
            populateCollection(documentGenerator, collection, documentCount);

            var proj = {};
            for (var i = 0; i < fieldsToIndex.length; ++i) {
                proj[fieldsToIndex[i]] = 1;
            }
            var indexOptions = undefined;
            if (fieldsToIndex.length > 0) {
                indexOptions = {wildcardProjection: proj};
            }
            assert.commandWorked(collection.createIndex({"$**": 1}, indexOptions));
        };
    }

    /**
     * Creates 2 performance regression tests, one with a $** index and a second with a set of regular
     * sparse indexes which cover the same fields.
     */
    function makeComparisonRemoveTest(
        name, fieldsToIndex, operationList, documentGenerator, documentCount) {
        addRemoveTest({
            name: name,
            tags: ["regression"],
            pre: getSetupFunctionWithWildcardIndex(fieldsToIndex, documentGenerator, documentCount),
            ops: operationList
        });
        addRemoveTest({
            name: name + ".Baseline",
            tags: ["regression"],
            pre: getSetupFunctionForTargetedIndex(fieldsToIndex, documentGenerator, documentCount),
            ops: operationList
        });
    }

    var kNumDocuments = 4800;
    var kNumDocumentsPerThread = 100;

    /**
     * Builds a set of operations that will remove then insert a single document for each field in
     * 'fieldList'.
     */
    function makeDeleteOperationList(fieldList) {
        var list = [];
        for (var i = 0; i < fieldList.length; ++i) {
            var letArg = {
                op: "let",
                target: "randVal",
                value: {"#RAND_INT_PLUS_THREAD": [0, kNumDocumentsPerThread]}
            };
            list.push(letArg);

            var doc = {};
            doc[fieldList[i]] = {"#VARIABLE": "randVal"};

            var removeArg = {op: "remove", query: doc};
            list.push(removeArg);

            var insertArg = {op: "insert", doc: doc};
            list.push(insertArg);
        }
        return list;
    }

    function makeDocumentGenerator(fieldList, numDocuments) {
        return function(seed) {
            var doc = {};
            for (var i = 0; i < fieldList.length; ++i) {
                doc[fieldList[i]] = seed;
            }
            return doc;
        };
    }

    /**
     * Returns a function which will generate a document with an array value of size 'arraySize'. This
     * array is populated with 'seed' which will be used as the query for the delete operation and
     * arraySize-1 values that are outside of the queryable range.
     */
    function makeArrayValueDocumentGenerator(fieldList, arraySize, numDocuments) {
        return function(seed) {
            var arrayValue = [seed];
            for (var i = 0; i < arraySize - 1; ++i) {
                arrayValue.push(10000 + i);
            }

            var doc = {};
            for (var i = 0; i < fieldList.length; ++i) {
                doc[fieldList[i]] = arrayValue;
            }
            return doc;
        };
    }

    var fieldList = getNFieldNames(1);
    makeComparisonRemoveTest("DeleteSingleField",
                             fieldList,
                             makeDeleteOperationList(fieldList),
                             makeDocumentGenerator(fieldList, kNumDocuments),
                             kNumDocuments);

    fieldList = getNFieldNames(10);
    makeComparisonRemoveTest("Delete10FieldDocument",
                             fieldList,
                             makeDeleteOperationList(fieldList),
                             makeDocumentGenerator(fieldList, kNumDocuments),
                             kNumDocuments);

    fieldList = getNFieldNames(1);
    makeComparisonRemoveTest("Delete100ElementArray",
                             fieldList,
                             makeDeleteOperationList(fieldList),
                             makeArrayValueDocumentGenerator(fieldList, 100, kNumDocuments),
                             kNumDocuments);
})();
