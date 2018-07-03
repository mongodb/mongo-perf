// TODO: Remove in SERVER-36198.
assert.commandWorked(db.adminCommand({setParameter: 1, internalQueryAllowAllPathsIndexes: true}));

if ((typeof tests === "undefined" ? "undefined" : typeof(tests)) != "object") {
    tests = [];
}

/*
 * Inserts value at the location specified by path (using dot notation) in object.
 * If there's a common non-object field name this function overrites the previous values.
 */
function setDottedFieldToValue(object, path, value) {
    if (path != undefined) {
        var fields = path.split(".");
        if (fields.length == 1) {
            object[path] = value;
            return object;
        } else {
            if (typeof(object[fields[0]]) !== "object") {
                object[fields[0]] = {};
            }
            setDottedFieldToValue(
                object[fields[0]], path.slice(fields[0].length + 1, path.length), value);
            return object;
        }
    } else {
        return object;
    }
}

/**
 * Creates test cases and adds them to the global testing array. By default,
 * each test case
 * specification produces several test cases:
 *
 * @param {Object} options - Options describing the test case.
 * @param {String} options.type - The name of the type of test case. It is
 * prepended to the test name.
 * @param {String} options.name - The name of the test case.
 * `${type}.AllPathsIndex.` is prepended.
 * @param {Object[]} options.ops - The operations to perform in benchRun.
 * @param {function} options.pre - A function that sets up for the test case.
 * @param {String[]} {options.tags=[]} - Additional tags describing this test.
 * The "all_paths" and
 * "indexed" tags are automatically added to test cases for collections.
 */
function addTest(options) {
    tests.push({
        name: options.type + ".AllPathsIndex." + options.name,
        tags: ["all_paths", "regression", "indexed"].concat(options.tags),
        pre: options.pre,
        ops: options.ops
    });
}

/*
 * 200 arbitrary field names
 */
var FIELD_NAMES = [];
for (var i = 0; i < 200; i++) {
    FIELD_NAMES.push("field-" + i);
}

/*
 * Constant used as a parameter for test cases.
 */
var INDEX_FOR_QUERIES = 3111;
var NUMBER_FOR_RANGE = 16;

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
 * Add NUMBER_FOR_RANGE values to an object.
 */
function addNumberForRangeValuesTopLevel(object, fieldNamesArray, offset, values) {
    return setNFields(object, fieldNamesArray, offset, values, NUMBER_FOR_RANGE);
}

/*
 * Helper function that has been exposed to allow for the use of the algebra later to compute
 * indexes of fields.
 */
function getNextFieldNameIndexForNestedDocument(offset, currentDepth, n, skip) {
    /**
     * Assuming that skip increases by one during each iteration, (n * (skip - 1)) is the "offset"
     * (relative to (offset + i - skip) i.e. the last fieldName that was used in the path) of the
     * last fieldName pulled in the previous iteration (where the path was the same). So we add one
     * to this expression to get the index of the next fieldName.
     */
    return offset + (currentDepth - 1) * skip + n * (skip - 1) + 1;
}

/*
 * Inserts n values into object[fieldNamesArray[offset]][fieldNamesArray[offset +
 * skip]]...[fieldNamesArray[offset + (maxDepth - 1) * skip]] (creating intermediate objects along
 * the way).
 * This function will overwrite intervening non-object values.
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
 * Adds NUMBER_FOR_RANGE nested fields to object in (drawn from fieldNamesArray w/ offset specified)
 * the value specified.
 */
function addNumberForRangeNestedFields(object, fieldNamesArray, offset, value) {
    return addNNestedFields(object, fieldNamesArray, offset, (NUMBER_FOR_RANGE - 1), 0, [value], 1);
}

/*
 * Helper function that has been exposed to allow for the use of the algebra later to compute
 * indexes of fields.
 */
function uniqueSkipHelper(index, length) {
    return Math.floor(index / length) + 1;
}

/*
 * Add documents where none of the documents share a path to a value.
 */
function insertDocumentsWithUniqueLeaves(collection) {
    collection.drop();
    var docs = [];
    for (var i = 0; i < 4800; i++) {
        docs.push(addNNestedFieldsWithSkip(
            {},           // object
            FIELD_NAMES,  // field names array
            i,            // offset
            1,            // maxDepth
            0,            // currentDepth
            [i],          // values
            2,            // n -- the deepest level documents will have two fields
            uniqueSkipHelper(i, FIELD_NAMES.length)  // skip
            ));
    }
    collection.insert(docs);
}

/*
 * Creates a collection of documents with values all in a two fields at the top level.
 * Since the standrad tests require that there be two fields (because it requires a compound index
 * query).
 */
function insertTwoFieldsDocs(collection) {
    collection.drop();
    var docs = [];
    for (var i = 0; i < 4800; i++) {
        docs.push({a: i, b: i});
    }
    assert.commandWorked(collection.insert(docs));
}

/*
 * Creates a collection of documents with NUMBER_FOR_RANGE values at the top
 * level.
 */
function insertMultipleFieldsDocs(collection) {
    collection.drop();
    var docs = [];
    for (var i = 0; i < 4800; i++) {
        docs.push(addNumberForRangeValuesTopLevel({}, FIELD_NAMES, i, [i]));
    }
    assert.commandWorked(collection.insert(docs));
}

/*
 * Create a collection of documents with values 16 fields in to the document.
 */
function insertDeeplyNestedDocs(collection) {
    collection.drop();
    var docs = [];
    for (var i = 0; i < 4800; i++) {
        docs.push(addNNestedFields({},                    // object
                                   FIELD_NAMES,           // field names array
                                   i,                     // offset
                                   NUMBER_FOR_RANGE - 1,  // maxDepth
                                   0,                     // currentDepth
                                   [i],                   // values
                                   NUMBER_FOR_RANGE       // n
                                   ));
    }
    assert.commandWorked(collection.insert(docs));
}

function setupDocumentsWithUniqueLeavesIndexed(collection) {
    insertDocumentsWithUniqueLeaves(collection);
    collection.createIndex({"$**": 1});
}

function setupTestTwoFieldsDocsIndexed(collection) {
    insertTwoFieldsDocs(collection);
    collection.createIndex({"$**": 1});
}

function setupTestMultipleFieldsDocsIndexed(collection) {
    insertMultipleFieldsDocs(collection);
    collection.createIndex({"$**": 1});
}

function setupDeeplyNestedDocsIndexed(collection) {
    insertDeeplyNestedDocs(collection);
    collection.createIndex({"$**": 1});
}

function setupTestMultipleFieldsDocsAllExcludedIndexed(collection) {
    insertMultipleFieldsDocs(collection);
    // There are no documents with a field "nonexistent" therefore this ensures that no part of a
    // docuemnt is indexed.
    collection.createIndex({"nonexistent.$**": 1});
}

var insertTags = ["insert"];

/*
 * Make a test that inserts doc.
 */
function makeInsertTest(name, pre, doc) {
    addTest({
        type: "Insert",
        name: name + ".InsertDoc",
        pre: pre,
        ops: [{op: "insert", doc: doc}],
        tags: insertTags
    });
}

/*
 * Makes the standard set of tests for a given scenario.
 * We take the "standard set of tests" to be this set of queries/updates/etc. that we run accross
 * each collection with certain document shapes.
 * Note: the range here is (lowerRange, upperRange].
 *
 * secondaryField and lowerRange are currently unused. They will be used for compound queries and
 * range queries respectively.
 * TODO: SERVER-36214 make compound & range queries so that these fields are used.
 */
function makeStandardTests(name, preIndexed, primaryField, secondaryField, lowerRange, upperRange) {
    makeInsertTest(name, preIndexed, setDottedFieldToValue({}, primaryField, upperRange));
}

makeStandardTests("TwoFields",
                  setupTestTwoFieldsDocsIndexed,
                  "a",
                  "b",
                  INDEX_FOR_QUERIES - NUMBER_FOR_RANGE,
                  INDEX_FOR_QUERIES);

makeStandardTests("MultipleFields",
                  setupTestMultipleFieldsDocsIndexed,
                  FIELD_NAMES[INDEX_FOR_QUERIES % FIELD_NAMES.length],
                  FIELD_NAMES[(INDEX_FOR_QUERIES + 1) % FIELD_NAMES.length],
                  INDEX_FOR_QUERIES - NUMBER_FOR_RANGE,
                  INDEX_FOR_QUERIES);

makeStandardTests("MultipleFieldsAllExcluded",
                  setupTestMultipleFieldsDocsAllExcludedIndexed,
                  FIELD_NAMES[INDEX_FOR_QUERIES % FIELD_NAMES.length],
                  FIELD_NAMES[(INDEX_FOR_QUERIES + 1) % FIELD_NAMES.length],
                  INDEX_FOR_QUERIES - NUMBER_FOR_RANGE,
                  INDEX_FOR_QUERIES);

/*
 * To get the primary and secondary fields that have value INDEX_FOR_QUERIES we use the helpers used
 * by insertDocumentsWithUniqueLeaves to create the documents.
 */
var skip = uniqueSkipHelper(INDEX_FOR_QUERIES, FIELD_NAMES.length);
makeStandardTests(
    "AllDiffFields",
    setupDocumentsWithUniqueLeavesIndexed,
    FIELD_NAMES[INDEX_FOR_QUERIES % FIELD_NAMES.length] + "." +
        FIELD_NAMES[getNextFieldNameIndexForNestedDocument(INDEX_FOR_QUERIES, 1, 2, skip) %
                    FIELD_NAMES.length],
    FIELD_NAMES[INDEX_FOR_QUERIES % FIELD_NAMES.length] + "." +
        FIELD_NAMES[(getNextFieldNameIndexForNestedDocument(INDEX_FOR_QUERIES, 1, 2, skip) + 1) %
                    FIELD_NAMES.length],
    INDEX_FOR_QUERIES - NUMBER_FOR_RANGE,
    INDEX_FOR_QUERIES);

function getPathToJthDeeplyNestedField(fieldNamesArray, offset, maxDepth, currentDepth, j) {
    if (currentDepth < maxDepth) {
        return fieldNamesArray[(offset + currentDepth) % fieldNamesArray.length] + "." +
            getPathToJthDeeplyNestedField(fieldNamesArray, offset, maxDepth, currentDepth + 1, j);
    } else {
        return fieldNamesArray[(offset + currentDepth + j) % fieldNamesArray.length];
    }
}

makeStandardTests(
    "DeeplyNested",
    setupDeeplyNestedDocsIndexed,
    getPathToJthDeeplyNestedField(FIELD_NAMES, INDEX_FOR_QUERIES, NUMBER_FOR_RANGE - 1, 0, 0),
    getPathToJthDeeplyNestedField(FIELD_NAMES, INDEX_FOR_QUERIES, NUMBER_FOR_RANGE - 1, 0, 1),
    110,
    INDEX_FOR_QUERIES);
