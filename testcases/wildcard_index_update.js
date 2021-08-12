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
    function addUpdateTest(options) {
        tests.push({
            name: "Update.WildcardIndex." + options.name,
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
     * used for comparison testing against the same data set with a $** index. Along with
     * 'fieldsToIndex', we also index a 'fieldName' + '_inc' field which is updated via $inc
     * operator by the update operations.
     */
    function getSetupFunctionForTargetedIndex(fieldsToIndex, documentGenerator, documentCount) {
        return function(collection) {
            collection.drop();
            populateCollection(documentGenerator, collection, documentCount);

            for (var i = 0; i < fieldsToIndex.length; ++i) {
                var indexSpec = {};
                indexSpec[fieldsToIndex[i]] = 1;
                assert.commandWorked(collection.createIndex(indexSpec, {sparse: true}));

                indexSpec = {};
                indexSpec[fieldsToIndex[i] + "_inc"] = 1;
                assert.commandWorked(collection.createIndex(indexSpec, {sparse: true}));
            }
        };
    }

    /**
     * Populates a collection with test data and creates a $** index.
     */
    function getSetupFunctionWithWildcardIndex(documentGenerator, documentCount) {
        return function(collection) {
            collection.drop();
            populateCollection(documentGenerator, collection, documentCount);
            assert.commandWorked(collection.createIndex({"$**": 1}));
        };
    }

    /**
     * Creates 2 performance regression tests, one with a $** index and a second with a set of
     * regular sparse indexes which cover the same the fields.
     */
    function makeComparisonUpdateTest(
        name, fieldsToIndex, operationList, documentGenerator, documentCount) {
        addUpdateTest({
            name: name,
            tags: ["regression"],
            pre: getSetupFunctionWithWildcardIndex(documentGenerator, documentCount),
            ops: operationList
        });
        addUpdateTest({
            name: name + ".Baseline",
            tags: ["regression"],
            pre: getSetupFunctionForTargetedIndex(fieldsToIndex, documentGenerator, documentCount),
            ops: operationList
        });
    }

    var kNumDocuments = 4800;
    var kNumDocumentsPerThread = 100;

    /**
     * Creates a set of operations which will find a single document and then increment a second
     * 'fieldName_inc' field.
     */
    function makeUpdateOperationList(fieldList) {
        var list = [];
        for (var i = 0; i < fieldList.length; ++i) {
            var incArg = {};
            incArg[fieldList[i] + "_inc"] = 1;

            var queryArg = {};
            queryArg[fieldList[i]] = {"#RAND_INT_PLUS_THREAD": [0, kNumDocumentsPerThread]};
            list.push({op: "update", query: queryArg, update: {$inc: incArg}});
        }
        return list;
    }

    function makeDocumentGenerator(fieldList) {
        return function(seed) {
            var doc = {};
            for (var i = 0; i < fieldList.length; ++i) {
                doc[fieldList[i]] = seed;
            }
            return doc;
        };
    }

    /**
     * Creates a set of operations which will find a single document via array value (stored as the
     * first element of the array) and then increments the value stored in the second element. This
     * is meant to exercise a "find document via multikey index and update an indexed value" use
     * case.
     */
    function makeArrayUpdateOperationList(fieldList) {
        var list = [];
        for (var i = 0; i < fieldList.length; ++i) {
            var incArg = {};
            incArg[fieldList[i] + ".1"] = 1;

            var queryArg = {};
            queryArg[fieldList[i]] = {"#RAND_INT_PLUS_THREAD": [0, kNumDocumentsPerThread]};
            list.push({op: "update", query: queryArg, update: {$inc: incArg}});
        }
        return list;
    }

    /**
     * Returns a function which will generate a document with an array value of size
     * 'arraySize'. This array is populated with 'seed' which will be used as the query for the
     * delete operation and 99 values that are outside of the queryable range.
     */
    function makeArrayValueDocumentGenerator(fieldList, arraySize) {
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
    makeComparisonUpdateTest("UpdateSingleField",
                             fieldList,
                             makeUpdateOperationList(fieldList),
                             makeDocumentGenerator(fieldList),
                             kNumDocuments);

    fieldList = getNFieldNames(10);
    makeComparisonUpdateTest("Update10FieldDocument",
                             fieldList,
                             makeUpdateOperationList(fieldList),
                             makeDocumentGenerator(fieldList),
                             kNumDocuments);

    fieldList = getNFieldNames(1);
    makeComparisonUpdateTest("UpdateArrayValue",
                             fieldList,
                             makeArrayUpdateOperationList(fieldList),
                             makeArrayValueDocumentGenerator(fieldList, 100),
                             kNumDocuments);
})();
