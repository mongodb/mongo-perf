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
    function addReadTest(options) {
        tests.push({
            name: "Queries.WildcardIndex." + options.name,
            tags: ["wildcard_read", "indexed", ">=4.1.3"].concat(options.tags),
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
     * Returns a function that generates a document with the fields listed in 'fieldList'. The value
     * for each field is an integer that is unique to a given document. If a field contains a dotted
     * path, it will be expanded to its corresponding object.
     *
     * Examples:
     * Input: fieldList: ["abc", "def"], seed: 1
     * Output: {abc: 1, def: 1}
     *
     * Input: fieldList: ["foo.bar"], seed: 2
     * Output: {foo: {bar: 2}}
     */
    function getMultiFieldPathToIntegerDocumentGenerator(fieldList) {
        assert(fieldList.length > 0);
        return function(seed) {
            var doc = {};
            for (var j = 0; j < fieldList.length; ++j) {
                setDottedFieldToValue(doc, fieldList[j], seed);
            }
            return doc;
        };
    }

    /**
     * Returns a function that generates a document with the fields listed in 'fieldList'. The value
     * for each field is an array of integers, each with a unique set of 'arraySize' numbers.
     *
     * Example:
     * Input: fieldList: ["abc", "def"], arraySize: 4, seed: 0
     * Output: {abc: [-2, -1, 0, 1], def: [-2, -1, 0, 1]}
     */
    function getTopLevelArrayMultiFieldDocumentGenerator(fieldList, arraySize) {
        assert(fieldList.length > 0);
        return function(seed) {
            var valueList = [];
            var value = seed - Math.ceil(arraySize / 2);
            for (var j = 0; j < arraySize; ++j) {
                valueList.push(value++);
            }

            var doc = {};
            for (var k = 0; k < fieldList.length; ++k) {
                doc[fieldList[k]] = valueList;
            }
            return doc;
        };
    }

    /**
     * Returns a function that generates a document with a single 'fieldList' field. The value for
     * each field is an array of integers, each with 'arraySize' numbers. If 'fieldList' contains
     * more than one field, this function will iterate over them, outputing a single field per
     * output document.
     *
     * Example 1:
     * Input: fieldList: ["abc", "def"], arraySize: 3, seed: 2
     * Output: {abc: [0,1,2]}
     *
     * Example 2:
     * Input: fieldList: ["abc", "def"], arraySize: 3, seed: 3
     * Output: {def: [0,1,2]}
     */
    function getTopLevelArraySingleFieldPerDocumentGenerator(fieldList, arraySize) {
        assert(fieldList.length > 0);
        return function(seed) {
            var value = [];
            for (var j = 0; j < arraySize; ++j) {
                value.push(j);
            }

            var doc = {};
            var currentFieldIndex = seed % fieldList.length;
            doc[fieldList[currentFieldIndex]] = value;
            return doc;
        };
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
    function getSetupFunctionWithWildcardIndex(projectionFields, documentGenerator, documentCount) {
        return function(collection) {
            collection.drop();
            populateCollection(documentGenerator, collection, documentCount);

            var proj = {};
            for (var i = 0; i < projectionFields.length; ++i) {
                proj[projectionFields[i]] = 1;
            }
            var indexOptions = undefined;
            if (projectionFields.length > 0) {
                indexOptions = {wildcardProjection: proj};
            }
            assert.commandWorked(collection.createIndex({"$**": 1}, indexOptions));
        };
    }

    /**
     * Creates a performance regression test with a $** index.
     */
    function makeStandaloneReadTest(
        name, fieldsToIndex, operationList, documentGenerator, documentCount) {
        addReadTest({
            name: name,
            tags: ["regression"],
            pre: getSetupFunctionWithWildcardIndex(fieldsToIndex, documentGenerator, documentCount),
            ops: operationList
        });
    }

    /**
     * Creates 2 performance regression tests, one with a $** index and a second with a set of
     * regular sparse indexes which cover the same the fields for comparison.
     */
    function makeComparisonReadTest(
        name, fieldsToIndex, operationList, documentGenerator, documentCount) {
        addReadTest({
            name: name,
            tags: ["regression"],
            pre: getSetupFunctionWithWildcardIndex(fieldsToIndex, documentGenerator, documentCount),
            ops: operationList
        });
        addReadTest({
            name: name + ".Baseline",
            tags: ["regression"],
            pre: getSetupFunctionForTargetedIndex(fieldsToIndex, documentGenerator, documentCount),
            ops: operationList
        });
    }

    /**
     * Returns a list of point query operations, each searching for a random value between 0 and
     * 'maxValue'.
     */
    function getPointQueryList(fieldList, maxValue) {
        var list = [];
        for (var i = 0; i < fieldList.length; ++i) {
            var query = {};
            query[fieldList[i]] = {"#RAND_INT": [0, maxValue]};
            list.push({op: "find", query: query});
        }
        return list;
    }

    /**
     * Returns a list of 2 predicate point query operations, each searching for 2 fields with a
     * random value between 0 and 'maxValue'.
     */
    function getTwoPointQueryList(fieldList, maxValue) {
        assert(fieldList.length === 2);

        var letArg = {op: "let", target: "randVal", value: {"#RAND_INT": [0, maxValue]}};

        var queryArg1 = {};
        queryArg1[fieldList[0]] = {"#VARIABLE": "randVal"};

        var queryArg2 = {};
        queryArg2[fieldList[1]] = {"#VARIABLE": "randVal"};

        var query = {$and: [queryArg1, queryArg2]};
        return [letArg, {op: "find", query: query}];
    }

    /**
     * Returns a list of range queries, searching for a 10 document range between 0 and 'maxValue'.
     */
    function getRangeQueryList(fieldList, maxValue) {
        Random.setRandomSeed(11010);

        var list = [];
        for (var i = 0; i < fieldList.length; ++i) {
            var query = {};
            var rangeStart = Random.randInt(maxValue - 10);

            query[fieldList[i]] = {$gte: rangeStart, $lte: (rangeStart + 10)};
            list.push({op: "find", query: query});
        }
        return list;
    }

    /**
     * Returns a list of range + sort queries, searching for a 10 document range between 0 and
     * 'maxValue', performing an indexed sort on the query field.
     */
    function getRangeSortQueryList(fieldList, maxValue) {
        Random.setRandomSeed(11010);

        var list = [];
        var sort = {};
        sort[fieldList[0]] = 1;
        for (var i = 0; i < fieldList.length; ++i) {
            var query = {};
            var rangeStart = Random.randInt(maxValue - 10);

            query[fieldList[i]] = {$gte: rangeStart, $lte: (rangeStart + 10)};
            list.push({op: "find", query, sort});
        }
        return list;
    }

    var kNumDocuments = 100;
    var kDefaultArraySize = 100;
    var fieldList = [];

    //
    // Standalone test which perfoms a point query against a single multikey path, in a collection
    // with 100 multikey paths.
    //

    fieldList = getNFieldNames(100);
    makeStandaloneReadTest("PointQueryAgainstCollectionWith100MultikeyPaths", fieldList,
                             getPointQueryList([fieldList[0]], 10 /* max value */), getTopLevelArraySingleFieldPerDocumentGenerator(fieldList, 10 /*array size */), kNumDocuments);

    //
    // Standalone test which performs a point query against a single non-existent field.
    //

    fieldList = getNFieldNames(1);
    makeStandaloneReadTest("PointQueryOnSingleNonExistentField", ["non-existent"],
                             getPointQueryList(["non-existent"], kNumDocuments), getMultiFieldPathToIntegerDocumentGenerator(fieldList), kNumDocuments);

    //
    // Point query against a single indexed field.
    //

    fieldList = getNFieldNames(1);
    makeComparisonReadTest("PointQueryOnSingleField", fieldList,
                             getPointQueryList(fieldList, kNumDocuments), getMultiFieldPathToIntegerDocumentGenerator(fieldList), kNumDocuments);

    fieldList = getNFieldNames(10);
    makeComparisonReadTest("PointQueryOnMultipleFields",
                           fieldList,
                           getPointQueryList(fieldList, kNumDocuments),
                           getMultiFieldPathToIntegerDocumentGenerator(fieldList),
                           kNumDocuments);

    fieldList = getNFieldNames(10);
    var kEmptyProjection = [];
    addReadTest({
        name: "PointQueryOnMultipleFields.WildcardIndexWithNoProjection",
        tags: ["regression"],
        pre: getSetupFunctionWithWildcardIndex(
            kEmptyProjection, getMultiFieldPathToIntegerDocumentGenerator(fieldList), kNumDocuments),
        ops: getPointQueryList(fieldList, kNumDocuments)
    });

    fieldList = getNFieldNames(1);
    makeComparisonReadTest("PointQueryOnSingleArrayField",
                           fieldList,
                           getPointQueryList(fieldList, kNumDocuments),
                           getTopLevelArrayMultiFieldDocumentGenerator(fieldList, kDefaultArraySize),
                           kNumDocuments);

    fieldList = getNFieldNames(10);
    makeComparisonReadTest("PointQueryOnMultipleArrayFields",
                           fieldList,
                           getPointQueryList(fieldList, kNumDocuments),
                           getTopLevelArrayMultiFieldDocumentGenerator(fieldList, kDefaultArraySize),
                           kNumDocuments);

    //
    // Range query.
    //

    fieldList = getNFieldNames(1);
    makeComparisonReadTest("RangeQueryOnSingleField", fieldList,
                             getRangeQueryList(fieldList, kNumDocuments), getMultiFieldPathToIntegerDocumentGenerator(fieldList), kNumDocuments);

    fieldList = getNFieldNames(10);
    makeComparisonReadTest("RangeQueryOnMultipleFields",
                           fieldList,
                           getRangeQueryList(fieldList, kNumDocuments),
                           getMultiFieldPathToIntegerDocumentGenerator(fieldList),
                           kNumDocuments);

    fieldList = getNFieldNames(1);
    makeComparisonReadTest("RangeQueryOnSingleArrayField",
                           fieldList,
                           getRangeQueryList(fieldList, kNumDocuments),
                           getTopLevelArrayMultiFieldDocumentGenerator(fieldList, kDefaultArraySize),
                           kNumDocuments);

    //
    // Range query with indexed sort.
    //

    fieldList = getNFieldNames(1);
    makeComparisonReadTest("RangeQueryWithSortOnSingleField", fieldList,
                             getRangeSortQueryList(fieldList, kNumDocuments), getMultiFieldPathToIntegerDocumentGenerator(fieldList), kNumDocuments);

    fieldList = getNFieldNames(10);
    makeComparisonReadTest("RangeQueryMultipleFieldsWithSortOnSingleField",
                           fieldList,
                           getRangeSortQueryList(fieldList, kNumDocuments),
                           getMultiFieldPathToIntegerDocumentGenerator(fieldList),
                           kNumDocuments);

    fieldList = getNFieldNames(1);
    makeComparisonReadTest("RangeQueryWithSortOnSingleArrayField",
                           fieldList,
                           getRangeSortQueryList(fieldList, kNumDocuments),
                           getTopLevelArrayMultiFieldDocumentGenerator(fieldList, 20 /* array size */),
                           kNumDocuments);

    //
    // Point query on 2 indexed fields.
    //

    fieldList = getNFieldNames(2);
    makeComparisonReadTest("PointQueryOnTwoFields", fieldList,
                             getTwoPointQueryList(fieldList, kNumDocuments), getMultiFieldPathToIntegerDocumentGenerator(fieldList), kNumDocuments);

    fieldList = getNFieldNames(2);
    makeComparisonReadTest("PointQueryOnTwoArrayFields",
                           fieldList,
                           getTwoPointQueryList(fieldList, kNumDocuments),
                           getTopLevelArrayMultiFieldDocumentGenerator(fieldList, kDefaultArraySize),
                           kNumDocuments);
})();
