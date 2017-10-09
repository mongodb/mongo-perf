if (typeof(tests) != "object") {
    tests = [];
}

/**
 * Creates a document validation insertion performance test named 'name' that inserts the document
 * 'doc' into a collection with document validator 'validator' or 'jsonSchema'. Also generates a
 * "comparison" test that does not use the validator to serve as a benchmark for the overhead of
 * document validation.
 *
 * If both 'validator' and 'jsonSchema' are specified, the two should be semantically equivalent,
 * such that the test compares the performance of JSON Schema against normal MongoDB match
 * expressions.
 */
function createDocValidationTest(name, doc, validator, jsonSchema) {
    var baseTags = ["insert", "DocValidation"];
    // Add a baseline test that simply inserts 'doc'.
    tests.push({
        name: name + ".Compare",
        tags: ["compare"].concat(baseTags),
        pre: function(collection) {
            collection.drop();
        },
        ops: [{op: "insert", doc: doc}]
    });

    // Add a test that inserts 'doc' into a collection with validator 'validator'.
    if (validator !== undefined) {
        tests.push({
            name: name,
            tags: ["regression"].concat(baseTags),
            pre: function(collection) {
                collection.drop();
                assert.commandWorked(collection.runCommand("create", {validator: validator}));
            },
            ops: [{op: "insert", doc: doc}]
        });
    }

    // Add a test that inserts 'doc' into a collection with validator 'jsonSchema'.
    if (jsonSchema !== undefined) {
        tests.push({
            name: name + ".JSONSchema",
            tags: ["regression", "jsonschema", ">=3.5"].concat(baseTags),
            pre: function(collection) {
                collection.drop();
                assert.commandWorked(
                    collection.runCommand("create", {validator: {$jsonSchema: jsonSchema}}));
            },
            ops: [{op: "insert", doc: doc}]
        });
    }
}

/**
 * Helper function which, given an integer 'n', generates a document of the form
 *
 *  {
 *      k1: {"#RAND_INT": [0, 10000]},
 *      k2: {"#RAND_INT": [0, 10000]},
 *      ...
 *  }
 *
 * for 'n' fields "k1" through "kn".
 */
function generateDocumentWithIntegerFields(n) {
    var obj = {};
    for (var i = 1; i <= n; ++i) {
        obj["k" + i] = {"#RAND_INT": [0, 10000]};
    }
    return obj;
}

/**
 * Helper function which, given an integer 'n', generates a document of the form
 *
 *  {
 *      $and: [
 *          {k1: {$exists: true}}, {k1: {$type: 16}},
 *          {k2: {$exists: true}}, {k2: {$type: 16}},
 *          ...
 *      ]
 *  }
 *
 * for 'n' fields "k1" through "kn".
 */
function generateValidatorWithIntegerFields(n) {
    var clauses = [];
    for (var i = 1; i <= n; ++i) {
        var fieldname = "k" + i;
        var clause1 = {};
        clause1[fieldname] = {$exists: true};
        clauses.push(clause1);
        var clause2 = {};
        clause2[fieldname] = {$type: 16};
        clauses.push(clause2);
    }
    return {$and: clauses};
}

/**
 * Helper function which, given an integer 'n', generates a document of the form
 *
 *  {
 *      properties: {
 *          k1: {bsonType: "int"},
 *          k2: {bsonType: "int"},
 *          ...
 *      },
 *      required: [
 *          "k1",
 *          "k2",
 *          ...
 *      ]
 *  }
 *
 * for 'n' fields "k1" through "kn".
 */
function generateJSONSchemaWithIntegerFields(n) {
    var properties = {};
    var required = [];
    for (var i = 1; i <= n; ++i) {
        var fieldname = "k" + i;
        properties[fieldname] = {bsonType: "int"};
        required.push(fieldname);
    }
    return {properties: properties, required: required};
}

/**
 * Tests inserting documents with a field which must exist and be an integer. This targets the use
 * of $type and $exists on a single field. Also generates a comparison JSON Schema test.
 */
var doc = generateDocumentWithIntegerFields(1);
var validator = generateValidatorWithIntegerFields(1);
var jsonSchema = generateJSONSchemaWithIntegerFields(1);
createDocValidationTest("Insert.DocValidation.OneInt", doc, validator, jsonSchema);

/**
 * Like the "OneInt" test, but validates that ten fields exist and are integers.
 */
doc = generateDocumentWithIntegerFields(10);
validator = generateValidatorWithIntegerFields(10);
createDocValidationTest("Insert.DocValidation.TenInt", doc, validator);

/**
 * Like the "OneInt" test, but validates that twenty fields exist and are integers. Also generates a
 * comparison JSON Schema test.
 */
doc = generateDocumentWithIntegerFields(20);
validator = generateValidatorWithIntegerFields(20);
jsonSchema = generateJSONSchemaWithIntegerFields(20);
createDocValidationTest("Insert.DocValidation.TwentyInt", doc, validator, jsonSchema);

/**
 * Like the "OneInt" test, but validates that 150 fields exist and are integers. Also generates a
 * comparison JSON Schema test.
 */
doc = generateDocumentWithIntegerFields(150);
validator = generateValidatorWithIntegerFields(150);
jsonSchema = generateJSONSchemaWithIntegerFields(150);
createDocValidationTest("Insert.DocValidation.OneFiftyInt", doc, validator, jsonSchema);

/**
 * Tests a JSON Schema that enforces a variety of constraints on twenty fields (not including the
 * _id).
 */
doc = {
    a: 0,
    b: 1,
    c: 2,
    d: 3,
    e: 4,
    f: "f",
    g: "g",
    h: "h",
    i: "i",
    j: "j",
    k: [0, 1, 2],
    l: ["a", "b", "c"],
    m: [{foo: "bar"}],
    n: [0, "a", {foo: "bar"}],
    o: [[1, 2], [3, 4]],
    p: {sku: "123"},
    q: {sku: 123},
    r: {value: 10},
    s: {value: -10},
    t: {}
};
validator = undefined;
jsonSchema = {
    minProperties: 15,
    maxProperties: 21,
    properties: {
        a: {type: "number"},
        b: {bsonType: "number"},
        c: {bsonType: "double"},
        d: {type: ["number", "string"]},
        e: {minimum: 0},
        f: {type: "string"},
        g: {bsonType: "string"},
        h: {type: ["string", "array"]},
        i: {minLength: 1},
        j: {maxLength: 1},
        k: {type: "array"},
        l: {bsonType: "array"},
        m: {bsonType: ["array", "object"]},
        n: {minItems: 1},
        o: {maxItems: 10},
        p: {type: "object"},
        q: {bsonType: "object"},
        r: {type: ["object", "string"]},
        s: {minProperties: 1},
        t: {maxProperties: 15}
    },
    required: ["_id", "a", "b", "f", "g", "k", "l", "p", "q"]
};
createDocValidationTest("Insert.DocValidation.Variety", doc, validator, jsonSchema);

/**
 * Tests a JSON Schema that enforces constraints on an array containing thirty items.
 */
doc = {
    a: [
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit",
        "sed do eiusmod tempor incididunt ut labore et dolore magna aliqua",
        "Ut enim ad minim veniam, quis nostrud exercitation ullamco",
        "laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor",
        "in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla",
        "pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa",
        "qui officia deserunt mollit anim id est laborum",
        {b: 0, c: 0},
        {b: 1, c: 1},
        {b: 2, c: 2},
        {b: 3, c: 3},
        {b: 4, c: 4},
        {b: 5, c: 5},
        {b: 6, c: 6},
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        [229, "West 43rd Street"],
        ["1-2-1", "銀座"],
        [29, "Rue Montmartre"],
        ["Maximilianstraße", 7],
        [70, "Comunipaw Avenue"],
        ["Prinzregentenstraße", 9],
        [120, "Ocean Avenue"],
        ["1-9-1", "丸の内"],
        [1600, "Pennsylvania Avenue"],
    ]
};
validator = undefined;
jsonSchema = {
    properties: {
        a: {
            type: ["array"],
            uniqueItems: true,
            minItems: 10,
            maxItems: 30,
            items: [
                {enum: ["Lorem ipsum dolor sit amet, consectetur adipiscing elit"]},
                {type: "string"},
                {type: ["string"]},
                {type: "string"},
                {minLength: 5},
                {maxLength: 90},
                {pattern: "[a-zA-Z .,]+"},
                {type: "object"},
                {minProperties: 1},
                {maxProperties: 3},
                {properties: {b: {type: "number"}}},
                {patternProperties: {c: {type: "number"}}},
                {required: ["b", "c"]},
                {properties: {b: {}, c: {}}, additionalProperties: false},
                {type: "number"},
                {type: ["number"]},
                {bsonType: "number"},
                {bsonType: ["int", "long", "number"]},
                {minimum: 0},
                {maximum: 10},
                {multipleOf: 2}
            ],
            additionalItems: {
                type: "array",
                oneOf: [
                    {items: [{type: "number"}, {type: "string"}]},
                    {items: [{type: "string"}, {type: "number"}]},
                    {items: [{type: "string"}, {type: "string"}]}
                ]
            }
        }
    },
    required: ["a"]
};
createDocValidationTest("Insert.DocValidation.Array", doc, validator, jsonSchema);

/**
 * Helper function which, given an integer 'n', generates a nested object
 *
 *  {
 *      kn: {
 *          k(n-1): {
 *              ...
 *          }
 *      }
 *  }
 *
 * that is 'n' levels deep, with field names "kn" through "k1". The deepest level is augmented with
 * some arbitrary string fields "sku", "country" and "name", and numeric fields "price" and "stock".
 */
function generateNestedDocumentOfDepth(n) {
    if (n == 0) {
        return {sku: "123", price: 3.14, country: "fr", stock: 1000, name: "widget"};
    }
    var document = {};
    document["k" + n] =  generateNestedDocumentOfDepth(n - 1);
    return document;
}

/**
 * Helper function which, given an integer 'n', generates a nested JSON Schema
 *
 *  {
 *      properties: {
 *          kn: {
 *              type: "object",
 *              properties: {
 *                  k(n-1): {
 *                      type: "object",
 *                      properties: {
 *                          ...
 *                      }
 *                  }
 *              }
 *          }
 *      }
 *  }
 *
 * that is 'n' levels deep, with property names "kn" through "k1". The deepest level adds
 * constraints on the fields "sku", "country", "name", "price" and "stock".
 *
 * Due to the recursive nature of this function and limitations of the mongo shell, do not exceed a
 * depth of 150 levels of nesting.
 */
function generateNestedJSONSchemaOfDepth(n) {
    if (n == 0) {
        return {
            properties: {
                sku: {type: "string"},
                price: {type: "number", minimum: 0, maximum: 10.0},
                country: {enum: ["fr", "es"]},
                stock: {type: "number", minimum: 0, multipleOf: 1},
                name: {type: "string"}
            }
        };
    }

    var fieldname = "k" + n;
    var embedded_object = {};
    embedded_object[fieldname] = {type: "object"};
    var schema = {properties: embedded_object};
    Object.extend(schema["properties"][fieldname], generateNestedJSONSchemaOfDepth(n - 1));
    return schema;
}

/**
 * Tests a JSON Schema that enforces constraints on a document nested thirty levels deep.
 */
doc = generateNestedDocumentOfDepth(30);
validator = undefined;
jsonSchema = generateNestedJSONSchemaOfDepth(30);
createDocValidationTest("Insert.DocValidation.Nested", doc, validator, jsonSchema);
