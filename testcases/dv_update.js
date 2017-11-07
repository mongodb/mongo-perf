if (typeof(tests) != "object") {
    tests = [];
}

/**
 * Creates a document validation update performance test named 'name'. During setup, it populates a
 * collection by obtaining documents from 'generator'. It then tests the overhead of executing
 * 'update' in the collection with a validator 'validator' or 'jsonSchema', compared to a baseline
 * where no validator is present.
 *
 * If both 'validator' and 'jsonSchema' are specified, the two should be semantically equivalent,
 * such that the test compares the performance of JSON Schema against normal MongoDB match
 * expressions.
 */
function createDocValidationTest(name, generator, update, validator, jsonSchema) {
    var baseTags = ["update", "DocValidation"];
    var numDocs = 4800;
    var query = {_id: {"#RAND_INT_PLUS_THREAD": [0, 100]}};
    var populate = function(collection) {
        var bulk = collection.initializeUnorderedBulkOp();
        for (var i = 0; i < numDocs; ++i) {
            bulk.insert(generator(i));
        }
        assert.writeOK(bulk.execute());
    };

    // Add a baseline test that performs 'update' in a collection with no validator.
    tests.push({
        name: name + ".Compare",
        tags: ["compare"].concat(baseTags),
        pre: function(collection) {
            collection.drop();
            populate(collection);
        },
        ops: [{op: "update", query: query, update: update}]
    });

    // Add a test that performs 'update' in a collection with validator 'validator'.
    if (validator !== undefined) {
        tests.push({
            name: name,
            tags: ["regression"].concat(baseTags),
            pre: function(collection) {
                collection.drop();
                assert.commandWorked(collection.runCommand("create", {validator: validator}));
                populate(collection);
            },
            ops: [{op: "update", query: query, update: update}]
        });
    }

    // Add a test that performs 'update' in a collection with validator 'jsonSchema'.
    if (jsonSchema !== undefined) {
        tests.push({
            name: name + ".JSONSchema",
            tags: ["regression", "jsonschema", ">=3.5"].concat(baseTags),
            pre: function(collection) {
                collection.drop();
                assert.commandWorked(
                    collection.runCommand("create", {validator: {$jsonSchema: jsonSchema}}));
                populate(collection);
            },
            ops: [{op: "update", query: query, update: update}]
        });
    }
}

/**
 * Helper function which, given an integer 'n', produces a function that generates documents. The
 * function takes a single input '_id', and generates a document of the form
 *
 *  {
 *      _id: _id,
 *      k1: 0,
 *      k2: 0
 *      ...
 *  }
 *
 * for 'n' fields "k1" through "kn".
 */
function generateDocumentGeneratorWithDoubleFields(n) {
    var obj = {};
    for (var i = 1; i <= n; ++i) {
        obj["k" + i] = 0;
    }

    return function(i) {
        return Object.extend({_id: i}, obj);
    };
}

/**
 * Helper function which, given an integer 'n', generates a document of the form
 *
 *  {
 *      $inc: {
 *          k1: 1,
 *          k2: 1,
 *          ...
 *      }
 *  }
 *
 * for 'n' fields "k1" through "kn".
 */
function generateUpdateIncrementDoubleFields(n) {
    var increments = {};
    for (var i = 1; i <= n; ++i) {
        increments["k" + i] = 1;
    }
    return {$inc: increments};
}

/**
 * Helper function which, given an integer 'n', generates a document of the form
 *
 *  {
 *      $and: [
 *          {k1: {$exists: true}}, {k1: {$type: 1}},
 *          {k2: {$exists: true}}, {k2: {$type: 1}},
 *          ...
 *      ]
 *  }
 *
 * for 'n' fields "k1" through "kn".
 */
function generateValidatorWithDoubleFields(n) {
    var clauses = [];
    for (var i = 1; i <= n; ++i) {
        var fieldname = "k" + i;
        var clause1 = {};
        clause1[fieldname] = {$exists: true};
        clauses.push(clause1);
        var clause2 = {};
        clause2[fieldname] = {$type: 1};
        clauses.push(clause2);
    }
    return {$and: clauses};
}

/**
 * Helper function which, given an integer 'n', generates a document of the form
 *
 *  {
 *      properties: {
 *          k1: {bsonType: "double"},
 *          k2: {bsonType: "double"},
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
function generateJSONSchemaWithDoubleFields(n) {
    var properties = {};
    var required = [];
    for (var i = 1; i <= n; ++i) {
        var fieldname = "k" + i;
        properties[fieldname] = {bsonType: "double"};
        required.push(fieldname);
    }
    return {properties: properties, required: required};
}

/**
 * Tests updating documents with a field which must exist and be a double. This targets the use of
 * $type and $exists on a single field. Also generates a comparison JSON Schema test.
 */
var generator = generateDocumentGeneratorWithDoubleFields(1);
var update = generateUpdateIncrementDoubleFields(1);
var validator = generateValidatorWithDoubleFields(1);
var jsonSchema = generateJSONSchemaWithDoubleFields(1);
createDocValidationTest("Update.DocValidation.OneNum", generator, update, validator, jsonSchema);

/**
 * Like the "OneNum" test, but validates that ten fields exist and are doubles.
 */
generator = generateDocumentGeneratorWithDoubleFields(10);
update = generateUpdateIncrementDoubleFields(10);
validator = generateValidatorWithDoubleFields(10);
createDocValidationTest("Update.DocValidation.TenNum", generator, update, validator);

/**
 * Like the "OneNum" test, but validates that twenty fields exist and are doubles. Also generates a
 * comparison JSON Schema test.
 */
generator = generateDocumentGeneratorWithDoubleFields(20);
update = generateUpdateIncrementDoubleFields(20);
validator = generateValidatorWithDoubleFields(20);
jsonSchema = generateJSONSchemaWithDoubleFields(20);
createDocValidationTest("Update.DocValidation.TwentyNum", generator, update, validator, jsonSchema);

/**
 * Like the "OneNum" test, but validates that 150 fields exist and are doubles. Also generates a
 * comparison JSON Schema test.
 */
generator = generateDocumentGeneratorWithDoubleFields(150);
update = generateUpdateIncrementDoubleFields(150);
validator = generateValidatorWithDoubleFields(150);
jsonSchema = generateJSONSchemaWithDoubleFields(150);
createDocValidationTest(
    "Update.DocValidation.OneFiftyNum", generator, update, validator, jsonSchema);

/**
 * Tests updates in the face of a JSON Schema validator that enforces a variety of constraints on
 * twenty fields (not including the _id).
 */
generator = function(i) {
    return {
        _id: i,
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
};
update = {
    $inc: {a: 1}
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
createDocValidationTest("Update.DocValidation.Variety", generator, update, validator, jsonSchema);

/**
 * Tests a JSON Schema that enforces constraints on an array containing thirty items.
 */
generator = function(i) {
    return {
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
};
update = {
    $inc: {"a.14": 1}
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
createDocValidationTest("Update.DocValidation.Array", generator, update, validator, jsonSchema);

/**
 * Helper function for generating nested documents. Not for public consumption; use
 * 'generateNestedDocumentGeneratorWithDepth()' instead.
 */
function generateNestedDocumentOfDepth(n) {
    if (n == 0) {
        return {sku: "123", price: 3.14, country: "fr", stock: 1000, name: "widget"};
    }

    var document = {};
    document["k" + n]= generateNestedDocumentOfDepth(n - 1);
    return document;
}

/**
 * Helper function which, given an integer 'n', returns a function that generates documents. The
 * function takes a single argument, '_id', and generates documents of the form
 *
 *  {
 *      _id: _id,
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
function generateNestedDocumentGeneratorWithDepth(n) {
    return function(i) {
        return Object.extend({_id: i}, generateNestedDocumentOfDepth(n));
    };
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
                price: {type: "number", minimum: 0},
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
generator = generateNestedDocumentGeneratorWithDepth(30);
update = {
    $inc: {
        "k30.k29.k28.k27.k26.k25.k24.k23.k22.k21.k20.k19.k18.k17.k16.k15.k14.k13.k12.k11.k10.k9.k8.k7.k6.k5.k4.k3.k2.k1.price":
            1,
        "k30.k29.k28.k27.k26.k25.k24.k23.k22.k21.k20.k19.k18.k17.k16.k15.k14.k13.k12.k11.k10.k9.k8.k7.k6.k5.k4.k3.k2.k1.stock":
            1,
    }
};
validator = undefined;
jsonSchema = generateNestedJSONSchemaOfDepth(30);
createDocValidationTest("Update.DocValidation.Nested", generator, update, validator, jsonSchema);
