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
            tags: ["regression", "jsonschema"].concat(baseTags),
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
 * Tests updating documents with a field which must exist and be a double. This targets the use of
 * $type and $exists on a single field. Also generates a comparison JSON Schema test.
 */
var generator = function(i) {
    return {_id: i, a: 0};
};
var update = {$inc: {a: 1}};
var validator = {$and: [{a: {$exists: true}}, {a: {$type: 1}}]};
var jsonSchema = {properties: {a: {bsonType: "double"}}, required: ["a"]};
createDocValidationTest("Update.DocValidation.OneNum", generator, update, validator, jsonSchema);

/**
 * Like the "OneNum" test, but validates that ten fields exist and are integers.
 */
generator = function(i) {
    return {_id: i, a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, g: 0, h: 0, i: 0, j: 0};
};
update = {
    $inc: {a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1, i: 1, j: 1}
};
validator = {
    $and: [
        {a: {$exists: true}}, {a: {$type: 1}}, {b: {$exists: true}}, {b: {$type: 1}},
        {c: {$exists: true}}, {c: {$type: 1}}, {d: {$exists: true}}, {d: {$type: 1}},
        {e: {$exists: true}}, {e: {$type: 1}}, {f: {$exists: true}}, {f: {$type: 1}},
        {g: {$exists: true}}, {g: {$type: 1}}, {h: {$exists: true}}, {h: {$type: 1}},
        {i: {$exists: true}}, {i: {$type: 1}}, {j: {$exists: true}}, {j: {$type: 1}},
    ]
};
createDocValidationTest("Update.DocValidation.TenNum", generator, update, validator);

/**
 * Like the "OneNum" test, but validates that twenty fields exist and are integers. Also generates a
 * comparison JSON Schema test.
 */
generator = function(i) {
    return {
        _id: i,
        a: 0,
        b: 0,
        c: 0,
        d: 0,
        e: 0,
        f: 0,
        g: 0,
        h: 0,
        i: 0,
        j: 0,
        k: 0,
        l: 0,
        m: 0,
        n: 0,
        o: 0,
        p: 0,
        q: 0,
        r: 0,
        s: 0,
        t: 0
    };
};
update = {
    $inc: {
        a: 1,
        b: 1,
        c: 1,
        d: 1,
        e: 1,
        f: 1,
        g: 1,
        h: 1,
        i: 1,
        j: 1,
        k: 1,
        l: 1,
        m: 1,
        n: 1,
        o: 1,
        p: 1,
        q: 1,
        r: 1,
        s: 1,
        t: 1
    }
};
validator = {
    $and: [
        {a: {$exists: true}}, {a: {$type: 1}}, {b: {$exists: true}}, {b: {$type: 1}},
        {c: {$exists: true}}, {c: {$type: 1}}, {d: {$exists: true}}, {d: {$type: 1}},
        {e: {$exists: true}}, {e: {$type: 1}}, {f: {$exists: true}}, {f: {$type: 1}},
        {g: {$exists: true}}, {g: {$type: 1}}, {h: {$exists: true}}, {h: {$type: 1}},
        {i: {$exists: true}}, {i: {$type: 1}}, {j: {$exists: true}}, {j: {$type: 1}},
        {k: {$exists: true}}, {k: {$type: 1}}, {l: {$exists: true}}, {l: {$type: 1}},
        {m: {$exists: true}}, {m: {$type: 1}}, {n: {$exists: true}}, {n: {$type: 1}},
        {o: {$exists: true}}, {o: {$type: 1}}, {p: {$exists: true}}, {p: {$type: 1}},
        {q: {$exists: true}}, {q: {$type: 1}}, {r: {$exists: true}}, {r: {$type: 1}},
        {s: {$exists: true}}, {s: {$type: 1}}, {t: {$exists: true}}, {t: {$type: 1}},
    ]
};
jsonSchema = {
    properties: {
        a: {bsonType: "double"},
        b: {bsonType: "double"},
        c: {bsonType: "double"},
        d: {bsonType: "double"},
        e: {bsonType: "double"},
        f: {bsonType: "double"},
        g: {bsonType: "double"},
        h: {bsonType: "double"},
        i: {bsonType: "double"},
        j: {bsonType: "double"},
        k: {bsonType: "double"},
        l: {bsonType: "double"},
        m: {bsonType: "double"},
        n: {bsonType: "double"},
        o: {bsonType: "double"},
        p: {bsonType: "double"},
        q: {bsonType: "double"},
        r: {bsonType: "double"},
        s: {bsonType: "double"},
        t: {bsonType: "double"},
    },
    required: [
        "a", "b", "c", "d", "e", "f", "g", "h", "i", "j",
        "k", "l", "m", "n", "o", "p", "q", "r", "s", "t"
    ]
};
createDocValidationTest("Update.DocValidation.TwentyNum", generator, update, validator, jsonSchema);

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
