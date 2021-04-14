if (typeof(tests) != "object") {
    tests = [];
}

/**
 * Setup: Populate a collection with an integer field X set to 0 and integer _id field. Create index
 * on X.
 * Test: Each thread works in a range of 100 documents; randomly selects a document using _id and
 * increments X; there will be contention on updating the index key.
 */
tests.push({
    name: "PipelineUpdate.IncWithIndex",
    tags: ["indexed", "pipeline-updates", "regression", ">=4.2.0"],
    pre: function(collection) {
        collection.drop();
        var docs = [];
        for (var i = 0; i < 4800; i++) {
            docs.push({_id: i, x: 0});
        }
        collection.insert(docs);
        collection.createIndex({x: 1});
    },
    ops: [
        {
          op: "update",
          query: {_id: {"#RAND_INT_PLUS_THREAD": [0, 100]}},
          update: [{$set: {x: {$add: ["$x", 1]}}}],
        },
    ],
});

/**
 * Setup: Starts with an empty collection; creates index on integer field X.
 * Test: Each thread works in a range of 100 documents; randomly selects a document using _id and
 * upserts(increment) X.
 */
tests.push({
    name: "PipelineUpdate.IncWithIndexUpsert",
    tags: ["indexed", "pipeline-updates", "regression", ">=4.2.0"],
    pre: function(collection) {
        collection.drop();
        collection.createIndex({x: 1});
    },
    ops: [
        {
          op: "update",
          upsert: true,
          query: {_id: {"#RAND_INT_PLUS_THREAD": [0, 100]}},
          update: [{$set: {x: {$add: ["$x", 1]}}}],
        },
    ],
});

var longFieldNames = [
    "kbgcslcybg", "kfexqflvce", "yitljbmriy", "vjhgznppgw", "ksnqrkckgm", "bxzrekmanf",
    "wgjptieoho", "miohmkbzvv", "iyymqfqfte", "nbbxrjspyu", "ftdmqxfvfo", "sqoccqelhp",
    "phbgzfvlvm", "ygvlusahma", "elcgijivrt", "qdwzjpugsr", "dhwgzxijck", "ezbztosivn",
    "gqnevrxtke", "jyzymmhtxc", "iqzleodwcl", "uvcbevobia", "fmsaehzaax", "hvekxgvche",
    "mudggeguxy", "jkpwpdfjjq", "ziujorptwj", "zygklvogup", "rtxpmvlegv", "nfzarcgpmf",
    "nlvbsgscbz", "yanwvoxeov", "ylqapkyfxn", "evlwtlejoe", "xvkejgtiuc", "sjkwfnrwpf",
    "gobpjhjrck", "ltpkggsgpb", "jzaathnsra", "uqiutzbcoa", "zwivxvtmgi", "glaibvnhix",
    "dosiyispnf", "nvtaemdwtp", "vzojziqbkj", "kbtfmcjlgl", "ialgxzuhnq", "djqfxvmycc",
    "ocrpwmeqyb", "tcrrliflby",
];

/**
 * Setup: Populate the collection with 100 documents, each has 50 integer fields with a ten
 * character field name plus an integer _id field.
 * Test: All threads work on the same 100 documents. Each thread progresses sequentially through the
 * collection by _id field, and increments the same 5 of the 20 integer fields in the document.
 */
tests.push({
    name: "PipelineUpdate.IncrementFewKeysLargeDocLongFields",
    tags: ["regression", "pipeline-updates", "regression", ">=4.2.0"],
    pre: function(collection) {
        collection.drop();

        var docs = [];
        for (var i = 0; i < 100; i++) {
            var toInsert = {_id: i};
            for (var j = 0; j < longFieldNames.length; j++) {
                toInsert[longFieldNames[j]] = 1;
            }
            docs.push(toInsert);
        }
        collection.insert(docs);
    },
    ops: [
        {
          op: "update",
          query: {
              _id: {
                  "#SEQ_INT": {seq_id: 0, start: 0, step: 1, mod: 100},
              },
          },
          update: [
              {
                $set: {
                    kbgcslcybg: {$add: ["$kbgcslcybg", 1]},
                    vjhgznppgw: {$add: ["$vjhgznppgw", 1]},
                    jzaathnsra: {$add: ["$jzaathnsra", 1]},
                    miohmkbzvv: {$add: ["$miohmkbzvv", 1]},
                    elcgijivrt: {$add: ["$elcgijivrt", 1]},
                },
              },
          ],
        },
    ],
});

/**
 * Setup: Create collection with integer _id and indexed integer field x with initial value 0, and
 * indexed random string field y.
 * Test: Each thread picks a random document based on _id, and sets fields x to a random integer and
 * y to different random string of the same length (updating both indexes). Each thread updates a
 * distinct range of documents.
 */
tests.push({
    name: "PipelineUpdate.SetWithMultiIndex.String",
    tags: ["indexed", "regression", "pipeline-updates", "regression", ">=4.2.0"],
    pre: function(collection) {
        collection.drop();
        var docs = [];
        for (var i = 0; i < 4800; i++) {
            docs.push({_id: i, x: 0, y: generateRandomString(1024)});
        }
        collection.insert(docs);
        collection.createIndex({x: 1});
        collection.createIndex({y: 1});
    },
    ops: [
        {
          op: "update",
          query: {_id: {"#RAND_INT_PLUS_THREAD": [0, 100]}},
          update: [{$set: {x: {"#RAND_INT": [0, 1000]}, y: {"#RAND_STRING": [1024]}}}]
        },
    ]
});

/**
 * Setup: Inserts a single document with the following shape into 'collection':
 * {
 *     _id: 0,
 *     a: 0,
 *     z: 0,
 *     h: {
 *         0: { // Hour 0.
 *             0: {n: 0, t: 0, v: 0}, // Minute 0.
 *             1: {n: 0, t: 0, v: 0}, // Minute 1.
 *             ...
 *             59: {n: 0, t: 0, v: 0} // Minute 59.
 *         },
 *         1: { // Hour 1.
 *             0: {n: 0, t: 0, v: 0}, // Minute 0.
 *             ...
 *             59: {n: 0, t: 0, v: 0} // Minute 59.
 *         },
 *         ...
 *         23: { // Hour 23.
 *             0: {n: 0, t: 0, v: 0}, // Minute 0.
 *             ...
 *             59: {n: 0, t: 0, v: 0} // Minute 59.
 *         }
 *     }
 * }
 * Test: Increment deep fields, some of which share a prefix, some of which do not.
 */
tests.push({
    name: "PipelineUpdate.MmsSetDeepDistinctPaths",
    tags: ["mms", "single_threaded", "pipeline-updates", "regression", ">=4.2.0"],
    pre: function(collection) {
        collection.drop();

        var base = {_id: 0, a: 0, h: {}, z: 0};
        for (var i = 0; i < 24; i++) {
            base.h[i] = {};
            for (var j = 0; j < 60; j++) {
                base.h[i][j] = {n: 0, t: 0, v: 0};
            }
        }
        collection.insert(base);
    },
    ops: [{
        op: "update",
        query: {_id: 0},
        update: [{
            $set: {
                // Use a random number to prevent the operations from becoming a no-op.
                "h.0.0.n": {"#RAND_INT": [0, 100]},
                "h.0.0.t": {"#RAND_INT": [0, 100]},
                "h.0.0.v": {"#RAND_INT": [0, 100]},
                "h.0.15.n": {"#RAND_INT": [0, 100]},
                "h.0.30.n": {"#RAND_INT": [0, 100]},
                "h.0.45.n": {"#RAND_INT": [0, 100]},
                "h.0.59.n": {"#RAND_INT": [0, 100]},
                "h.12.0.n": {"#RAND_INT": [0, 100]},
                "h.12.15.n": {"#RAND_INT": [0, 100]},
                "h.12.30.n": {"#RAND_INT": [0, 100]},
                "h.12.45.n": {"#RAND_INT": [0, 100]},
                "h.12.59.n": {"#RAND_INT": [0, 100]},
                "h.12.59.t": {"#RAND_INT": [0, 100]},
                "h.12.59.v": {"#RAND_INT": [0, 100]},
            }
        }]
    }]
});

/**
 * Setup: Populate collection with unique integer _id and an integer field X = 0. Create index on X.
 * Test: All threads select the same 20 documents (1590 < _id < 1610) and update the indexed field X
 * by $inc (with multi=true).
 * Notes: High contention on the 20 documents updated as well as on index X.
 */
tests.push({
    name: "PipelineUpdate.Multi.Contended.Hot.Indexed",
    tags: ["indexed", "pipeline-updates", "regression", ">=4.2.0"],
    pre: function(collection) {
        collection.drop();
        var docs = [];
        for (var i = 0; i < 4800; i++) {
            docs.push({_id: i, x: 0});
        }
        collection.insert(docs);
        collection.createIndex({x: 1});
    },
    ops: [
        {
          op: "update",
          multi: true,
          query: {_id: {$gt: 1590, $lt: 1610}},
          update: [{$set: {x: {$add: ["$x", 1]}}}]
        },
    ]
});

/**
 * Setup: Populate collection with an arrays of increasing size and their size as a number.
 * Test: Simultaneously update each array and its size so they remain in sync.
 */
tests.push({
    name: "PipelineUpdate.FieldsSimultaneously",
    tags: ["pipeline-updates", "regression", ">=4.2.0"],
    pre: function(collection) {
        collection.drop();
        var docs = [];
        var array = [];
        for (var i = 0; i < 100; i++) {
            array.push("string " + i.toString());
            docs.push({tags: [...array], tagsSize: i + 1});
        }

        var bulk = collection.initializeUnorderedBulkOp();
        for (var i = 0; i < 2400; i++) {
            bulk.insert(Object.merge({_id: i}, docs[i % 200]));
        }
        assert.writeOK(bulk.execute());
    },
    ops: [
        {
          op: "update",
          multi: true,
          query: {},
          update: [{
              $set: {
                  tags: {$concatArrays: ["$tags", ["new string"]]},
                  tagsSize: {$add: ["$tagsSize", 1]}
              }
          }]
        },
    ]
});

/**
 * Setup: Populate collection with an array of increasing values and size.
 * Test: Update the array by filtering out even numbers and then adding some back in as one
 * operation.
 */
tests.push({
    name: "PipelineUpdate.ArrayFieldInTwoDifferentWays",
    tags: ["pipeline-updates", "regression", ">=4.2.0"],
    pre: function(collection) {
        collection.drop();
        var array = [];
        var bulk = collection.initializeUnorderedBulkOp();
        for (var i = 0; i < 600; i++) {
            array.push(i);
            bulk.insert({_id: i, numbers: array});
        }
        assert.writeOK(bulk.execute());
    },
    ops: [
        {
          op: "update",
          multi: true,
          query: {},
          update: [
              {
                $set: {
                    numbers: {
                        $filter: {
                            input: "$numbers",
                            as: "number",
                            cond: {$eq: [{$mod: ["$$number", 2]}, 0]},
                        }
                    }
                }
              },
              {
                $set: {
                    numbers: {
                        $concatArrays: [
                            "$numbers",
                            [
                              15, 13, 95, 42, 42, 26, 74,  89, 83, 32, 50, 42, 60, 74, 83, 7,  82,
                              97, 27, 51, 14, 86, 79, 12,  38, 76, 20, 16, 31, 58, 20, 59, 41, 24,
                              93, 96, 40, 29, 16, 98, 93,  31, 25, 67, 22, 52, 69, 96, 31, 23, 13,
                              11, 78, 4,  6,  8,  97, 100, 11, 17, 4,  60, 76, 36, 84, 3,  14, 85,
                              72, 5,  55, 56, 90, 27, 66,  22, 4,  75, 20, 49, 40, 45, 24, 43, 98,
                              32, 77, 2,  58, 6,  28, 31,  96, 50, 31, 88, 81, 88, 22, 33
                            ]
                        ]
                    }
                }
              }
          ]
        },
    ]
});

/**
 * Setup: Populate collection with dates from varying years.
 * Test: Update the dates to add a day while reining in those outside a certain maximum.
 */
tests.push({
    name: "PipelineUpdate.ConditionalUpdate",
    tags: ["pipeline-updates", "regression", ">=4.2.0"],
    pre: function(collection) {
        collection.drop();
        var docs = [];
        for (var i = 0; i < 1000; i++) {
            docs.push({_id: i, date: new Date((2000 + i).toString() + "-01-01")});
        }
        collection.insert(docs);
    },
    ops: [
        {
          op: "update",
          multi: true,
          query: {},
          update: [
              {
                $set: {
                    date: {
                        $cond: {
                            if: {$gt: ["$date", new Date("2500-1-1")]},
                            then: new Date("2500-1-2"),
                            else: {$add: ["$date", 1000 * 60 * 60 * 24]}
                        },
                    }
                }
              },
          ]
        },
    ]
});

/**
 * Setup: Populate collection with two types of integers and an array of previous values for one
 * type of integer with one historical value each.
 * Test: First move the existing values of each type into the arrays to story history, creating the
 * array for each type if it doesn't exist already. Then update the integers.
 */
tests.push({
    name: "PipelineUpdate.MaintainHistory",
    tags: ["pipeline-updates", "regression", ">=4.2.0"],
    pre: function(collection) {
        collection.drop();
        var docs = [];
        for (var i = 0; i < 2400; i++) {
            docs.push({
                _id: i,
                x: NumberDecimal(i),
                y: NumberLong(i),
                oldYs: [{dateChanged: new Date(), prevValue: NumberLong(i - 12)}]
            });
        }
        collection.insert(docs);
    },
    ops: [{
        op: "update",
        multi: true,
        query: {},
        update: [
            {
              $set: {
                  oldXs: {
                      $let: {
                          vars: {xEntry: [{dateChanged: "$$NOW", prevValue: "$x"}]},
                          in : {
                              $cond: {
                                  if: {$isArray: ["$oldXs"]},
                                  then: {$concatArrays: ["$oldXs", "$$xEntry"]},
                                  else: "$$xEntry"
                              }
                          }
                      }
                  },
                  oldYs: {
                      $let: {
                          vars: {yEntry: [{dateChanged: "$$NOW", prevValue: "$y"}]},
                          in : {
                              $cond: {
                                  if: {$isArray: ["$oldYs"]},
                                  then: {$concatArrays: ["$oldYs", ["$$yEntry"]]},
                                  else: ["$$yEntry"]
                              }
                          }
                      }
                  }
              }
            },
            {$set: {x: NumberDecimal(42), y: NumberLong(42)}}
        ]
    }]
});

/**
 * Semantically equivalent to an existing workload which uses the "classic" update language called
 * 'FindAndModifySortedUpdate' except this uses a pipeline-style update to increment the count
 * field.
 */
tests.push({
    name: "PipelineUpdate.FindAndModify.SortedUpdate",
    tags: ["command", "pipeline-updates", "regression", ">=4.2.0"],
    pre: function setUpFindAndModifySortedUpdateWithPipeline(collection) {
        collection.drop();
        Random.setRandomSeed(22002);
        var nDocs = 5000;
        var bulk = collection.initializeUnorderedBulkOp();
        for (var i = 0; i < nDocs; i++) {
            bulk.insert({count: 0, rand: Random.rand()});
        }
        bulk.execute();
    },
    ops: [{
        op: "command",
        ns: "#B_DB",
        command: {
            findAndModify: "#B_COLL",
            query: {},
            update: [{$set: {count: {$add: ["$count", 1]}}}],
            sort: {count: 1, rand: 1}
        }
    }]
});

/**
 * Semantically equivalent to an existing workload which uses the "classic" update language called
 * 'FindAndModifySortedUpdateIndexed' except this uses a pipeline-style update to increment the
 * count field.
 */
tests.push({
    name: "PipelineUpdate.FindAndModify.SortedUpdateIndexed",
    tags: ["command", "pipeline-updates", "regression", ">=4.2.0"],
    pre: function setUpFindAndModifySortedUpdate(collection) {
        collection.drop();
        Random.setRandomSeed(22002);
        var nDocs = 5000;
        var bulk = collection.initializeUnorderedBulkOp();
        for (var i = 0; i < nDocs; i++) {
            bulk.insert({count: 0, rand: Random.rand()});
        }
        bulk.execute();
        collection.createIndex({count: 1, rand: 1});
    },
    ops: [{
        op: "command",
        ns: "#B_DB",
        command: {
            findAndModify: "#B_COLL",
            query: {},
            update: [{$set: {count: {$add: ["$count", 1]}}}],
            sort: {count: 1, rand: 1}
        }
    }]
});

function addExtraCreditPipeline() {
    // Chooses a random assignment in the 'grades' array and adds 5 points to its score.
    return [
        {
          $set: {
              grades: {
                  $map: {
                      input: "$grades",
                      in : {
                          $cond: {
                              if: {
                                  $eq: [
                                      "$$this._id",
                                      {
                                        $concat:
                                            ["assignment_", {$toString: {"#RAND_INT": [0, 50]}}]
                                      }
                                  ]
                              },
                              then: {
                                  $mergeObjects: [
                                      "$$this",
                                      {
                                        grade: {
                                            $add: ["$$this.grade", 5],
                                        },
                                      },
                                  ],
                              },
                              else: "$$this",
                          },
                      },
                  },
              },
          },
        },
        {$set: {overall_grade: {$avg: "$grades.grade"}}},
    ];
}

/*
 * Setup: Create collection where each document represents the grades for a particular student.
 * Test: Call findAndModify to add extra credit to an assignment and re-compute the student's total
 * grade, returning the new total grade.
 */
tests.push({
    name: "PipelineUpdate.FindAndModify.GradeAdjustment",
    tags: ["command", "pipeline-updates", "regression", ">=4.2.0"],
    pre: function setUpFindAndModifyGradeAdjustment(collection) {
        collection.drop();
        Random.setRandomSeed(22002);
        var nDocs = 5000;
        var bulk = collection.initializeUnorderedBulkOp();
        for (var i = 0; i < nDocs; i++) {
            var grades = [];
            var total_score = 0;
            for (var j = 0; j < 50; j++) {
                score = 50 + Random.randInt(50);  // Between 50 and 100.
                grades.push({_id: "assignment_" + j, grade: score});
                total_score += score;
            }
            bulk.insert({
                _id: i,
                student_name: "placeholder name",
                overall_grade: total_score / 50,
                grades: grades
            });
        }
        bulk.execute();
    },
    ops: [
        {
          op: "command",
          ns: "#B_DB",
          command: {
              findAndModify: "#B_COLL",
              query: {_id: {"#RAND_INT": [0, 5000]}},
              update: addExtraCreditPipeline(),
              new: true,
              fields: {overall_grade: 1}
          }
        },
    ]
});

/*
 * Setup: Create collection where each document represents the grades for a particular student.
 * Test: Call findAndModify to add extra credit to the student with the lowest grade and re-compute
 * the student's total grade, returning the new total grade.
 */
tests.push({
    name: "PipelineUpdate.FindAndModify.GradeAdjustmentSorted",
    tags: ["command", "pipeline-updates", "regression", ">=4.2.0"],
    pre: function setUpFindAndModifyGradeAdjustmentSorted(collection) {
        collection.drop();
        Random.setRandomSeed(22002);
        var nDocs = 5000;
        var bulk = collection.initializeUnorderedBulkOp();
        for (var i = 0; i < nDocs; i++) {
            var grades = [];
            var total_score = 0;
            for (var j = 0; j < 50; j++) {
                score = 50 + Random.randInt(50);  // Between 50 and 100.
                grades.push({_id: "assginment_" + j, grade: score});
                total_score += score;
            }
            bulk.insert({
                _id: i,
                student_name: "placeholder name",
                overall_grade: total_score / 50,
                grades: grades
            });
        }
        bulk.execute();
    },
    ops: [
        {
          op: "command",
          ns: "#B_DB",
          command: {
              findAndModify: "#B_COLL",
              query: {},
              update: addExtraCreditPipeline(),
              new: true,
              fields: {overall_grade: 1},
              sort: {overall_grade: -1}
          }
        },
    ]
});

