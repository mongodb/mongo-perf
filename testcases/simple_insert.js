
if ( typeof(tests) != "object" )
    tests = [];

tests.push( { name: "Insert.Empty",
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op:  "insert",
                    safe: false, w: 0, j: false, writeCmd: false,
                    doc: {} }
              ] } );

tests.push( { name: "Insert.EmptyCapped",
              pre: function( collection ) {
                  collection.drop();
                  collection.runCommand( "create", { capped : true,
                                                     size : 32 * 1024 } );
              },
              ops: [
                  { op:  "insert",
                    safe: false, w: 0, j: false, writeCmd: false,
                    doc: {} }
              ] } );

tests.push( { name: "Insert.JustID",
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op:  "insert", 
                    safe: false, w: 0, j: false, writeCmd: false,
                    doc: { _id: { "#OID": 1 } } }
              ] } );

tests.push( { name: "Insert.IntID",
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({a: 1});
              },
              ops: [
                  { op:  "insert",
                    safe: false, w: 0, j: false, writeCmd: false,
                    doc:
                        { _id: { "#SEQ_INT":
                            { seq_id: 0, start: 0, step: 1, unique: true } } } }
              ] } );

tests.push( { name: "Insert.IntIDUpsert",
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op:  "update",
                    safe: false, w: 0, j: false, writeCmd: false,
                    upsert : true,
                    query: { _id: { "#SEQ_INT":
                                { seq_id: 0, start: 0, step: 1, unique: true } } },
                    update: { }
                  }
              ] } );

tests.push( { name: "Insert.JustNum",
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op:  "insert",
                    safe: false, w: 0, j: false, writeCmd: false,
                    doc:
                        { x: { "#SEQ_INT":
                            { seq_id: 0, start: 0, step: 1, unique: true } } } }
              ] } );

tests.push( { name: "Insert.JustNumIndexedBefore",
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({x: 1});
              },
              ops: [
                  { op:  "insert",
                    safe: false, w: 0, j: false, writeCmd: false,
                    doc:
                        { x: { "#SEQ_INT":
                            { seq_id: 0, start: 0, step: 1, unique: true } } } }
              ] } );

tests.push( { name: "Insert.NumAndID",
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op: "insert",
                    safe: false, w: 0, j: false, writeCmd: false,
                    doc:
                        { _id: { "#OID": 1 },
                          x: { "#SEQ_INT":
                                { seq_id: 0, start: 0, step: 1, unique: true } } } }
              ] } );
