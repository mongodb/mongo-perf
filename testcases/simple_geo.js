if ( typeof(tests) != "object" ) {
    tests = [];
}

// generate a grid map from (x1, y1) to (x2, y2), with 100x100 point grid
function generateGridMap(collection, x1, y1, x2, y2, indexType, legacy) {
    var step_x = (x2 - x1) / 100.0;
    var step_y = (y2 - y1) / 100.0;

    collection.drop(); 
    collection.createIndex({loc: indexType});

    var count = 0;
    for( var i = x1; i < x2; ) {
        var bulk = collection.initializeUnorderedBulkOp();

        for(var j = y1; j < y2; ) {
            bulk.insert({
                loc: legacy ? [i, j] : {type: "Point", coordinates: [i, j]}, 
                include: (count++) % 100 == 0
            });
            j = j + step_y;
        }
        bulk.execute( {w: 1});
        i = i + step_x;
    }
}

/* General Test Setup Notes:
 *    - will create a grid map with proper storage format (geoJSON or legacy 
 *      format) and with proper index (2d or 2dsphere)
 *    - the map is from [-0.005, -0.005] to [0.005, 0.005] with 100 point 
 *      on each side, this is a relatively dense map, with around 10m 
 *      between points
 *    - test is run from 13x13 grid of points evenly distributed over the map
 *      query is run from a smaller area to make sure query not go out of bound
 *    - query point shall not overlap any point in collection
 */

// define the area for the map in collection
var x_min = -0.005;
var x_max =  0.005;
var y_min = -0.005;
var y_max =  0.005;

// define the area to run query from
// leave 1/7 out on each edge to make sure query are not run out of bound
var x_query_min = x_min * (6.0/7.0);
var x_query_max = x_max * (6.0/7.0);
var y_query_min = y_min * (6.0/7.0);
var y_query_max = y_max * (6.0/7.0);

// query will run from a 13x13 grid
var x_query_step = (x_query_max - x_query_min) / 13.0;
var y_query_step = (y_query_max - y_query_min) / 13.0;


/* Testcase: Geo.geoJSON.nearSphere.2dsphere.find */
var ops = [];
for( var i = 0; i < 5; i++) {
    for( var j = 0; j < 5; j++) {
        ops.push({
            op: "find", 
            query: {loc: {$nearSphere: {
                $geometry: {
                    type: "Point", 
                    coordinates: [x_query_min + x_query_step * i, 
                                  y_query_min + y_query_step * j]}, 
                $maxDistance: 50}}}});
    }
}

/* 
 * Setup: create map with 2dsphere index
 * Test: Geo.geoJSON.nearSphere.2dsphere.find
 *     - to test nearSphere query with geoJSON format, 
 *     - with 2dsphere index
 *     - the $maxDistance make sure return ~60 per query
 */
tests.push( { name: "Geo.geoJSON.nearSphere.2dsphere.find",
              tags: ['geo','core','indexed'],
              pre: function( collection ) { 
                  generateGridMap(collection, 
                          x_min, y_min, x_max, y_max, "2dsphere", false);
              },
              ops: ops } );


/* Testcase: Geo.geoJSON.nearSphere.2dsphere.withFilter.find30 */
var ops = [];
for( var i = 0; i < 5; i++) {
    for( var j = 0; j < 5; j++) {
        ops.push({
            op: "find", 
            limit: 30,
            query: {loc: {$nearSphere: {
                $geometry: {
                    type: "Point", 
                    coordinates: [x_query_min + x_query_step * i, 
                                  y_query_min + y_query_step * j]}}},
                include: true}});
    }
}

/* 
 * Setup: create map with 2dsphere index
 * Test: Geo.geoJSON.nearSphere.2dsphere.withFilter.find30
 *     - to test nearSphere query with geoJSON format, 
 *     - with 2dsphere index
 *     - only return docs that pass {include: true} (one in 100 results)
 *     - limit to 30 docs
 *     - should scan ~3,000 documents
 */
tests.push( { name: "Geo.geoJSON.nearSphere.2dsphere.withFilter.find30",
              tags: ['geo','core','indexed'],
              pre: function( collection ) { 
                  generateGridMap(collection, 
                          x_min, y_min, x_max, y_max, "2dsphere", false);
              },
              ops: ops } );


/* Testcase: Geo.geoJSON.nearSphere.2dsphere.findOne */
ops = [];
for( var i = 0; i < 5; i++) {
    for( var j = 0; j < 5; j++) {
        ops.push({
            op: "findOne", 
            query: {loc: {$nearSphere: {
                $geometry: {
                    type: "Point", 
                    coordinates: [x_query_min + x_query_step * i, 
                                  y_query_min + y_query_step * j]}, 
                }}}});
    }
}

/*
 * Setup: generate map with geoJson format with 2dsphere index
 * Test: Geo.geoJSON.nearSphere.2dsphere.findOne
 *     - to test nearSphere query with geoJSON format, 
 *     - with 2dsphere index
 *     - find one doc only per operation
 */
tests.push( { name: "Geo.geoJSON.nearSphere.2dsphere.findOne",
              tags: ['geo','core','indexed'],
              pre: function( collection ) { 
                  generateGridMap(collection, 
                        x_min, y_min, x_max, y_max, "2dsphere", false);
              },
              ops: ops } );


/* Testcase: Geo.geoJSON.within.2dsphere.centersphere */
ops = [];
for( var i = 0; i < 5; i++) {
    for( var j = 0; j < 5; j++) {
        ops.push({
            op: "find", 
            limit: 10,
            query: {loc: {$geoWithin: {
                $centerSphere: [[x_query_min + x_query_step * i, 
                                 y_query_min + y_query_step * j], 
                                0.0000078], 
                }}}});
    }
}

/*
 * Setup: generat map with geoJson format with 2dsphere index
 * Test: Geo.geoJSON.within.2dsphere.centersphere 
 *     - to test $within by centersphere query with geoJSON format, 
 *     - with 2dsphere index
 *     - every operation finds ~10 doc
 */
tests.push( { name: "Geo.geoJSON.within.2dsphere.centersphere",
              tags: ['geo','core','indexed'],
              pre: function( collection ) { 
                  generateGridMap(collection, 
                          x_min, y_min, x_max, y_max, "2dsphere", false);
              },
              ops: ops } );

/* Testcase: Geo.near.2d.find100 */
ops = [];
for( var i = 0; i < 5; i++) {
    for( var j = 0; j < 5; j++) {
        ops.push({
            op: "find", 
            limit: 100,
            query: {loc: { $near: [x_query_min + x_query_step * i, 
                                   y_query_min + y_query_step * j]}
            }});
    }
}

/*
 * Setup: generate map with 2d index
 * Test: Geo.near.2d.find100
 *     - to test $near query with legacy format, 
 *     - with 2d index
 *     - limit to 100 doc
 */
tests.push( { name: "Geo.near.2d.find100",
              tags: ['geo','core','indexed'],
              pre: function( collection ) { 
                  generateGridMap(collection, 
                          x_min, y_min, x_max, y_max, "2d", true);
              },
              ops: ops } );


/* Testcase: Geo.near.2d.withFilter.find30 */
ops = [];
for( var i = 0; i < 5; i++) {
    for( var j = 0; j < 5; j++) {
        ops.push({
            op: "find", 
            limit: 30,
            query: {loc: { $near: [x_query_min + x_query_step * i, 
                                   y_query_min + y_query_step * j]},
                    include: true
            }});
    }
}

/*
 * Setup: generate map with 2d index
 * Test: Geo.near.2d.withFilter.find30
 *     - to test $near query with legacy format, 
 *     - with 2d index
*      - only return docs that pass {include: true} (one in 100 results)
 *     - limit to 30 docs
 *     - should scan ~3,000 documents
 */
tests.push( { name: "Geo.near.2d.withFilter.find30",
              tags: ['geo','core','indexed'],
              pre: function( collection ) { 
                  generateGridMap(collection, 
                          x_min, y_min, x_max, y_max, "2d", true);
              },
              ops: ops } );


/* Testcase: Geo.near.2d.findOne */
ops = [];
for( var i = 0; i < 5; i++) {
    for( var j = 0; j < 5; j++) {
        ops.push({
            op: "findOne", 
            query: {loc: { $near: [x_query_min + x_query_step * i, 
                                   y_query_min + y_query_step * j]}
            }});
    }
}

/*
 * Setup:
 * Test: Geo.near.2d.findOne
 *     - to test $near query with legacy format, 
 *     - with 2d index
 */
tests.push( { name: "Geo.near.2d.findOne",
              tags: ['geo','core','indexed'],
              pre: function( collection ) { 
                  generateGridMap(collection, 
                          x_min, y_min, x_max, y_max, "2d", true);
              },
              ops: ops } );


/* Testcase: Geo.within.2d.find */
ops = [];
for( var i = 0; i < 5; i++) {
    for( var j = 0; j < 5; j++) {
        ops.push({
            op: "find", 
            query: {loc: { $geoWithin: {
                $center: [[x_query_min + x_query_step * i, 
                           y_query_min + y_query_step * j], 
                         0.00057]}}
            }});
    }
}

/*
 * Test: Geo.within.2d.find
 *     - to test $geoWithin with $center query with legacy format, 
 *     - with 2d index
 *     - limit to 100 doc via distance
 */
tests.push( { name: "Geo.within.2d.find",
              tags: ['geo','core','indexed'],
              pre: function( collection ) { 
                  generateGridMap(collection, 
                          x_min, y_min, x_max, y_max, "2d", true);
              },
              ops: ops } );

