if ((typeof tests === "undefined" ? "undefined" : typeof(tests)) != "object") {
    tests = [];
}

(function () {
    'use strict';
    /**
     * Creates test cases and adds them to the global testing array.
     *
     * @param {Object} options - Options describing the test case.
     * @param {String} options.type - The name of the type of test case. It is
     * prepended to the test name.
     * @param {String} options.name - The name of the test case.
     * `${type}.WildCardIndex.` is prepended.
     * @param {Object[]} options.ops - The operations to perform in benchRun.
     * @param {function} options.pre - A function that sets up for the test case.
     * @param {String[]} {options.tags=[]} - Additional tags describing this test.
     * The "wildcard", "indexed", and ">=4.1.3" tags are added automatically.
     */
    function addTest(options) {
        tests.push({
            name: options.type + ".WildCardIndex." + options.name,
            tags: ["wildcard_write", "indexed", ">=4.1.3"].concat(options.tags),
            pre: options.pre,
            ops: options.ops
        });
    }

    /*
     * Adds n fields (from fieldNamesArray with offset offset) and assigns values from values.
     */
    var setNFields = function setNFields(object, fieldNamesArray, offset, values, n) {
        for (var i = 0; i < n; i++) {
            var field = fieldNamesArray[(offset + i) % fieldNamesArray.length];
            object[field] = values[i % values.length];
        }
        return object;
    };

    /*
     * Helper function that has been exposed to allow for the use of the algebra later to compute
     * indexes of fields.
     */
    function getNextFieldNameIndexForNestedDocument(offset, currentDepth, n, skip) {
        /**
         * Assuming that skip increases by one during each iteration, (n * (skip - 1)) is the
         * "offset" (relative to (offset + i - skip) i.e. the last fieldName that was used in the
         * path) of the last fieldName pulled in the previous iteration (where the path was the
         * same). So we add one to this expression to get the index of the next fieldName.
         */
        return offset + (currentDepth - 1) * skip + n * (skip - 1) + 1;
    }

    /*
     * Inserts n values into object[fieldNamesArray[offset]][fieldNamesArray[offset +
     * skip]]...[fieldNamesArray[offset + (maxDepth - 1) * skip]] (creating intermediate objects
     * along the way).  This function will overwrite intervening non-object values.
     */
    function addNNestedFieldsWithSkip(
        object, fieldNamesArray, offset, maxDepth, currentDepth, values, n, skip) {
        var field = fieldNamesArray[(offset + (currentDepth * skip)) % fieldNamesArray.length];
        if (currentDepth < maxDepth) {
            if (typeof(object[field]) != "object") {
                object[field] = {};
            }
            addNNestedFieldsWithSkip(
                object[field], fieldNamesArray, offset, maxDepth, currentDepth + 1, values, n, skip);
        } else {
            setNFields(object,
                       fieldNamesArray,
                       getNextFieldNameIndexForNestedDocument(offset, currentDepth, n, skip),
                       values,
                       n,
                       skip);
        }
        return object;
    }

    /*
     * Inserts n values into object[fieldNamesArray[offset]][fieldNamesArray[offset +
     * 1]]...fieldNamesArray[offset + maxDepth - 1] (creating intermediate objects along the way).
     * This function will overwrite intervening non-object values.
     */
    function addNNestedFields(object, fieldNamesArray, offset, maxDepth, currentDepth, values, n) {
        return addNNestedFieldsWithSkip(
            object, fieldNamesArray, offset, maxDepth, currentDepth, values, n, 1);
    }

    /*
     * Helper function that has been exposed to allow for the use of the algebra later to compute
     * indexes of fields.
     */
    function uniqueSkipHelper(index, length) {
        return Math.floor(index / length) + 1;
    }

    /*
     * Get a docGenerator for producing documents where the documents will very rarely (depending on
     * fieldNamesArr) share paths to a value (After roughly (fieldNamesArr.length^2) / 2 calls, it will
     * return duplicates, but for our purposes this isn't a problem).
     */
    function getDocGeneratorForUniqueLeaves(fieldNamesArr) {
        return function(seed) {
            return addNNestedFieldsWithSkip({},             // object
                                            fieldNamesArr,  // field names array
                                            seed,           // offset
                                            1,              // maxDepth
                                            0,              // currentDepth
                                            [seed],         // values
                                            2,  // n -- the deepest level documents will have two fields
                                            uniqueSkipHelper(seed, fieldNamesArr.length)  // skip
                                           );
        };
    }

    /**
     * Returns a function, that when called will produce a document with top level fields
     * from 'fieldNameArr'.
     */
    function getDocGeneratorForTopLevelFields(fieldNameArr) {
        return function(seed) {
            return setNFields({}, fieldNameArr, 0, [seed], fieldNameArr.length);
        };
    }

    function getDocGeneratorForDeeplyNestedFields(fieldNameArr, documentDepth, nFieldsInLeaf) {
        return function(seed) {
            return addNNestedFields({},             // object
                                    fieldNameArr,   // field names array
                                    seed,           // offset
                                    documentDepth,  // maxDepth
                                    0,              // currentDepth
                                    [seed],         // values
                                    nFieldsInLeaf   // n
                                   );
        };
    }

    function getSetupFunctionForTargetedIndex(fieldsToIndex) {
        return function(collection) {
            collection.drop();
            // Instead of creating a wildcard index, creating a normal index for each top-level
            // field used. This way, the same number of index entries are created, regardless of
            // whether we use an wildcard index, or a targeted index.
            for (var i = 0; i < fieldsToIndex.length; i++) {
                var fieldName = fieldsToIndex[i];
                assert.commandWorked(collection.createIndex(
                    setDottedFieldToValue({}, fieldsToIndex[i], 1), {sparse: true}));
            }
        };
    }

    /**
     * Returns a function, which when called, will drop the given collection and create a $** index on
     * 'fieldsToIndex'. If 'fieldsToIndex' is empty, it will create a $** index on all fields.
     */
    function getSetupFunctionWithWildCardIndex(projectionFields) {
        return function(collection) {
            collection.drop();
            var proj = {};
            for (var i = 0; i < projectionFields.length; i++) {
                proj[projectionFields[i]] = 1;
            }
            var indexOptions = undefined;
            if (projectionFields.length > 0) {
                indexOptions = {wildcardProjection: proj};
            }
            assert.commandWorked(collection.createIndex({"$**": 1}, indexOptions));
        };
    }

    var kInsertTags = ["wildcard_insert"];

    /*
     * Make a test that inserts doc.
     */
    function makeInsertTestForDocType(name, pre, documentGenerator, additionalTags) {
        if (typeof(additionalTags) === "undefined") {
            additionalTags = [];
        }

        var opsList = [];
        for (var i = 0; i < 1000; i++) {
            opsList.push({op: "insert", doc: documentGenerator(i)});
        }
        addTest({
            type: "Insert",
            name: name + ".InsertDoc",
            pre: pre,
            ops: opsList,
            tags: kInsertTags.concat(additionalTags)
        });
    }

    makeInsertTestForDocType("MultipleFieldsAllExcluded",
                             getSetupFunctionWithWildCardIndex(["nonexistent"]),
                             getDocGeneratorForTopLevelFields(getNFieldNames(16)),
                             ["regression"]);
    makeInsertTestForDocType("AllDiffFields",
                             getSetupFunctionWithWildCardIndex([]),
                             getDocGeneratorForUniqueLeaves(getNFieldNames(200)),
                             ["regression"]);
    var NUMBER_FOR_RANGE = 16;
    makeInsertTestForDocType("DeeplyNested",
                             getSetupFunctionWithWildCardIndex([]),
                             getDocGeneratorForDeeplyNestedFields(
                                 getNFieldNames(200), NUMBER_FOR_RANGE, NUMBER_FOR_RANGE - 1),
                             ["regression"]);

    // Comparison tests which use a standard index.

    function makeComparisonWriteTest(name, fieldsToIndex, documentGenerator) {
        makeInsertTestForDocType(name + ".WildCardIndex",
                                 getSetupFunctionWithWildCardIndex(fieldsToIndex),
                                 documentGenerator,
                                 ["core"]);
        makeInsertTestForDocType(name + ".WildCardIndexNoProjection",
                                 getSetupFunctionWithWildCardIndex([]),
                                 documentGenerator,
                                 ["core"]);
        makeInsertTestForDocType(name + ".StandardIndex",
                                 getSetupFunctionForTargetedIndex(fieldsToIndex),
                                 documentGenerator,
                                 ["core"]);
    }

    for (var i = 1; i <= 16; i *= 2) {
        var fieldNameArr = getNFieldNames(i);
        var name = "TopLevelFields-" + i;
        makeComparisonWriteTest(name, fieldNameArr, getDocGeneratorForTopLevelFields(fieldNameArr));
    }
})();
