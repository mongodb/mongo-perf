if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name: "Insert.Empty",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op:  "insert",
                    doc: {} }
              ] } );

tests.push( { name: "Insert.EmptyCapped",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.runCommand( "create", { capped : true,
                                                     size : 32 * 1024 } );
              },
              ops: [
                  { op:  "insert",
                    doc: {} }
              ] } );

tests.push( { name: "Insert.v0.EmptyCapped.SeqID",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.runCommand( "create", { capped : true,
                                                     size : 32 * 1024 } );
              },
              ops: [
                  { op:  "insert",
                    doc: { _id: { "#SEQ_INT":
                                    { seq_id: 0, start: 0, step: 1, unique: true }
                                }
                         }
                  }
              ] } );

tests.push( { name: "Insert.JustID",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op:  "insert", 
                    doc: { _id: { "#OID": 1 } } }
              ] } );

tests.push( { name: "Insert.IntID",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({a: 1});
              },
              ops: [
                  { op:  "insert",
                    doc:
                        { _id: { "#SEQ_INT":
                            { seq_id: 0, start: 0, step: 1, unique: true } } } }
              ] } );

tests.push( { name: "Insert.IntIDUpsert",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op:  "update",
                    upsert : true,
                    query: { _id: { "#SEQ_INT":
                                { seq_id: 0, start: 0, step: 1, unique: true } } },
                    update: { }
                  }
              ] } );

tests.push( { name: "Insert.JustNum",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op:  "insert",
                    doc:
                        { x: { "#SEQ_INT":
                            { seq_id: 0, start: 0, step: 1, unique: true } } } }
              ] } );

tests.push( { name: "Insert.JustNumIndexedBefore",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({x: 1});
              },
              ops: [
                  { op:  "insert",
                    doc:
                        { x: { "#SEQ_INT":
                            { seq_id: 0, start: 0, step: 1, unique: true } } } }
              ] } );

tests.push( { name: "Insert.NumAndID",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op: "insert",
                    doc:
                        { _id: { "#OID": 1 },
                          x: { "#SEQ_INT":
                                { seq_id: 0, start: 0, step: 1, unique: true } } } }
              ] } );
