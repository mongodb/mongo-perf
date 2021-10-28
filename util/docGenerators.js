/**
 * The intent of testing query or aggregation with small documents is to have small overhead
 * associated with parsing and copying them while having enough fields to run queries with different
 * characteristics such as selectivity, complex expressions, sub-fields and arrays access, etc.
 *
 * @param {Number} i - the number to be used as _id
 * @returns - a document of size ~280 bytes (Object.bsonsize(smallDoc(N)))
 */
const smallDoc = function (i) {
    return {
        _id: i,
        a: Random.randInt(10),
        b: Random.randInt(1000),
        c: Random.rand() * 100 + 1, // no zeros in this field
        d: i % 10000,
        e: {
            a: Random.randInt(10),
            b: Random.randInt(1000),
            c: Random.rand() * 100 + 1,
            e: { u: Random.randInt(100), v: Random.randInt(100) },
            f: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
            g: Random.rand() * 10,
            h: Random.rand() * 1000,
            i: Random.rand() * 100000,
        },
        f: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
        g: Random.rand() * 10,
        h: Random.rand() * 1000,
        i: Random.rand() * 100000,
    };
}

/**
 * The intent of testing query or aggregation with large documents is to make it clear when there is
 * overhead associated with parsing and copying them.
 *
 * @param {Number} i - the number to be used as _id
 * @returns - a document of size ~8500 bytes (Object.bsonsize(largeDoc(N)))
 */
const quotes = [
    "Silly things do cease to be silly if they are done by sensible people in an impudent way.",
    "I may have lost my heart, but not my self-control.",
    "Success supposes endeavour.",
    "One half of the world cannot understand the pleasures of the other.",
    "It is not every man’s fate to marry the woman who loves him best.",
    "Blessed with so many resources within myself the world was not necessary to me. I could do very well without it.",
    "It is very difficult for the prosperous to be humble.",
    "Better be without sense than misapply it as you do.",
    "Surprises are foolish things. The pleasure is not enhanced, and the inconvenience is often considerable.",
];
const largeDoc = function (i) {
    return {
        _id: i,
        a: Random.randInt(10),
        b: Random.randInt(1000),
        c: Random.rand() * 100 + 1, // no zeros in this field
        d: i % 10000,
        e: {
            a: Random.randInt(10),
            b: Random.randInt(1000),
            c: Random.rand() * 100 + 1,
            e: { u: Random.randInt(100), v: Random.randInt(100) },
            f: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
            g: Random.rand() * 10,
            h: Random.rand() * 1000,
            i: Random.rand() * 100000,
        },

        
        f: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
        g: Random.rand() * 10,
        h: Random.rand() * 1000,
        i: Random.rand() * 100000,

        // Fields the queries won't be accessing but might need to copy/scan over.
        p1: [quotes, quotes, quotes, quotes, quotes],
        p2: { author: " Jane Austen", work: "Emma", quotes: quotes },
        p3: { a: quotes[0] + i.toString(), b: quotes[2] + (i % 10).toString(), c: quotes[4] },
        p4: [quotes, quotes, quotes, quotes, quotes],

        // Fields towards the end of the object some of the tests will be using.
        aa: Random.randInt(10),
        bb: Random.randInt(1000),
        cc: Random.rand() * 100 + 1,
        dd: i % 10000,
        ee: {
            a: Random.randInt(10),
            b: Random.randInt(1000),
            c: Random.rand() * 100 + 1,
            e: { u: Random.randInt(100), v: Random.randInt(100) },
            f: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
            g: Random.rand() * 10,
            h: Random.rand() * 1000,
            i: Random.rand() * 100000,
        },
        ff: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
        gg: Random.rand() * 10,
        hh: Random.rand() * 1000,
        ii: Random.rand() * 100000,
    };
}
