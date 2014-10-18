
if ( typeof(tests) != "object" ) {
    tests = [];
}

// generate a grid map from (x1, y1) to (x2, y2)`
function generateGridMap(collection, x1, y1, x2, y2) {
    for( var i = x1; i < ( x2 + 1); i++) {
        for(var j = y1; j < (y2 + 1); j++) {
            collection.insert({loc: [i, j]});
        }
    }
}

function generateGridMapGeoJSON(collection, x1, y1, x2, y2) {
    for( var i = x1; i < ( x2 + 1); i++) {
        for(var j = y1; j < (y2 + 1); j++) {
            collection.insert({loc: {type: "Point", coordinates: [i, j]}});
        }
    }
}

// geoWithin
tests.push( { name: "Geo.within.2dsphere.polygon",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMap(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "find", query: {loc: { $geoWithin: {$geometry: { type: "Polygon", coordinates: [[ [-10,-10], [ 8, -9], [10, 10], [ 5,  6], [-9,  9], [-10,-10] ] ] } }} } }
              ] } );

tests.push( { name: "Geo.within.2dsphere.polygon.offcenter",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMap(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "find", query: {loc: { $geoWithin: {$geometry: { type: "Polygon", coordinates: [[ [  0,-20], [18,-19], [20,  0], [15, -4], [ 1, -1], [  0,-20] ] ] } }} } }
              ] } );

tests.push( { name: "Geo.geoJSON.within.2dsphere.polygon",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "find", query: {loc: { $geoWithin: {$geometry: { type: "Polygon", coordinates: [[ [-10,-10], [ 8, -9], [10, 10], [ 5,  6], [-9,  9], [-10,-10] ] ] } }} } }
              ] } );

tests.push( { name: "Geo.geoJSON.within.2dsphere.polygon.offcenter",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "find", query: {loc: { $geoWithin: {$geometry: { type: "Polygon", coordinates: [[ [  0,-20], [18,-19], [20,  0], [15, -4], [ 1, -1], [  0,-20] ] ] } }} } }
              ] } );

tests.push( { name: "Geo.within.2dsphere.centersphere",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) { 
                    collection.drop(); 
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMap(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "find", query: {loc: { $geoWithin: {$centerSphere: [[0, 0], 0.175]}} } }
              ] } );

tests.push( { name: "Geo.within.2dsphere.centersphere.offcenter",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) { 
                    collection.drop(); 
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMap(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "find", query: {loc: { $geoWithin: {$centerSphere: [[20, -20], 0.175]}} } }
              ] } );

tests.push( { name: "Geo.geoJSON.within.2dsphere.centersphere",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) { 
                    collection.drop(); 
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "find", query: {loc: { $geoWithin: {$centerSphere: [[0, 0], 0.175]}} } }
              ] } );

tests.push( { name: "Geo.geoJSON.within.2dsphere.centersphere.offcenter",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) { 
                    collection.drop(); 
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "find", query: {loc: { $geoWithin: {$centerSphere: [[20, -20], 0.175]}} } }
              ] } );
// findOne
tests.push( { name: "Geo.within.2dsphere.polygon.findOne",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMap(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "findOne", query: {loc: { $geoWithin: {$geometry: { type: "Polygon", coordinates: [[ [-10,-10], [ 8, -9], [10, 10], [ 5,  6], [-9,  9], [-10,-10] ] ] } }} } }
              ] } );

tests.push( { name: "Geo.within.2dsphere.polygon.findOne.offcenter",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMap(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "findOne", query: {loc: { $geoWithin: {$geometry: { type: "Polygon", coordinates: [[ [  0,-20], [18,-19], [20,  0], [15, -4], [ 1, -1], [  0,-20] ] ] } }} } }
              ] } );

tests.push( { name: "Geo.geoJSON.within.2dsphere.polygon.findOne",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "findOne", query: {loc: { $geoWithin: {$geometry: { type: "Polygon", coordinates: [[ [-10,-10], [ 8, -9], [10, 10], [ 5,  6], [-9,  9], [-10,-10] ] ] } }} } }
              ] } );

tests.push( { name: "Geo.geoJSON.within.2dsphere.polygon.findOne.offcenter",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "findOne", query: {loc: { $geoWithin: {$geometry: { type: "Polygon", coordinates: [[ [  0,-20], [18,-19], [20,  0], [15, -4], [ 1, -1], [  0,-20] ] ] } }} } }
              ] } );


tests.push( { name: "Geo.within.2dsphere.centerSphere.findOne",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) { 
                    collection.drop(); 
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMap(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "findOne", query: {loc: { $geoWithin: {$centerSphere: [[0, 0], 0.175]}} } }
              ] } );

tests.push( { name: "Geo.within.2dsphere.centerSphere.findOne.offcenter",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) { 
                    collection.drop(); 
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMap(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "findOne", query: {loc: { $geoWithin: {$centerSphere: [[20, -20], 0.175]}} } }
              ] } );

tests.push( { name: "Geo.geoJSON.within.2dsphere.centerSphere.findOne",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) { 
                    collection.drop(); 
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "findOne", query: {loc: { $geoWithin: {$centerSphere: [[0, 0], 0.175]}} } }
              ] } );

tests.push( { name: "Geo.geoJSON.within.2dsphere.centerSphere.findOne.offcenter",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) { 
                    collection.drop(); 
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "findOne", query: {loc: { $geoWithin: {$centerSphere: [[20, -20], 0.175]}} } }
              ] } );



// geoNear
tests.push( { name: "Geo.near.2dSphere.findOne.center",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMap(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "findOne", query: {loc: { $near: {$geometry: {type: "Point", coordinates: [0.1, 0.1]}}}}}
              ] } );

tests.push( { name: "Geo.near.2dSphere.findOne.offcenter",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMap(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "findOne", query: {loc: { $near: {$geometry: {type: "Point", coordinates: [20.1, -20.1]}}}}}
              ] } );

tests.push( { name: "Geo.near.2dSphere.find100.center",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMap(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "find", limit: 100, query: {loc: { $near: {$geometry: {type: "Point", coordinates: [0.1, 0.1]}}}}}
              ] } );


tests.push( { name: "Geo.near.2dSphere.find100.offcenter",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMap(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "find", limit: 100, query: {loc: { $near: {$geometry: {type: "Point", coordinates: [-20.1, -20.1]}}}}}
              ] } );


// geoNear with GeoJSON as location
tests.push( { name: "Geo.geoJSON.near.2dSphere.findOne.center",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "findOne", query: {loc: { $near: {$geometry: {type: "Point", coordinates: [0.1, 0.1]}}}}}
              ] } );

tests.push( { name: "Geo.geoJSON.near.2dSphere.findOne.offcenter",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "findOne", query: {loc: { $near: {$geometry: {type: "Point", coordinates: [20.1, -20.1]}}}}}
              ] } );

tests.push( { name: "Geo.geoJSON.near.2dSphere.find100.center",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "find", limit: 100, query: {loc: { $near: {$geometry: {type: "Point", coordinates: [0.1, 0.1]}}}}}
              ] } );


tests.push( { name: "Geo.geoJSON.near.2dSphere.find100.offcenter",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "find", limit: 100, query: {loc: { $near: {$geometry: {type: "Point", coordinates: [-20.1, -20.1]}}}}}
              ] } );


// geoNearSphere
tests.push( { name: "Geo.geoJSON.nearSphere.2dsphere.findOne.center",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) { 
                    collection.drop(); 
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "findOne", query: {loc: { $nearSphere: {$geometry: { type: "Point", coordinates: [ 0.1,  0.1]} } } } }
              ] } );

tests.push( { name: "Geo.geoJSON.nearSphere.2dsphere.findOne.offcenter",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) { 
                    collection.drop(); 
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "findOne", query: {loc: { $nearSphere: {$geometry: { type: "Point", coordinates: [-20.1, -20.1]} } } } }
              ] } );

tests.push( { name: "Geo.geoJSON.nearSphere.2dsphere.find.center",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) { 
                    collection.drop(); 
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "find", query: {loc: { $nearSphere: {$geometry: { type: "Point", coordinates: [ 0.1,  0.1]}, $maxDistance: 1130000 } } } }
              ] } );

tests.push( { name: "Geo.geoJSON.nearSphere.2dsphere.find.offcenter",
              tags: ['geo','daily','weekly','monthly'],
              pre: function( collection ) { 
                    collection.drop(); 
                  collection.ensureIndex({loc: "2dsphere"});
                  generateGridMapGeoJSON(collection, -50, -50, 50, 50);
              },
              ops: [
                  { op: "find", query: {loc: { $nearSphere: {$geometry: { type: "Point", coordinates: [-20.1, -20.1]}, $maxDistance: 1105000 } } } }
              ] } );


