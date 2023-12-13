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

/**
 * Variant of largeDoc() that has field name lengths and sometimes shared field name prefixes more
 * typical of a production database. The doc contents are otherwise the same.
 *
 * @param {Number} i - the number to be used as _id
 * @returns - a document of size ~8500 bytes (Object.bsonsize(largeDoc(N)))
 */
const largeDocLargeFieldNames = function (i) {
    return {
        _id: i,
        customer: Random.randInt(10),
        tracking_number: Random.randInt(1000),
        date_created: Random.rand() * 100 + 1, // no zeros in this field
        date_last_modified: i % 10000,
        order_details: {
            antelopes: Random.randInt(10),
            brontosauri: Random.randInt(1000),
            price: Random.rand() * 100 + 1,
            widgets: { u: Random.randInt(100), v: Random.randInt(100) },
            special_widgets: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
            sale_price: Random.rand() * 10,
            discount_code: Random.rand() * 1000,
            promotion_code: Random.rand() * 100000,
        },

        order_ids: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
        timestamp: Random.rand() * 10,
        credit_card_number: Random.rand() * 1000,
        phone_number: Random.rand() * 100000,

        // Fields the queries won't be accessing but might need to copy/scan over.
        customer_comments: [quotes, quotes, quotes, quotes, quotes],
        favorite_products: { author: " Jane Austen", work: "Emma", quotes: quotes },
        frequently_viewed_pages: { a: quotes[0] + i.toString(), b: quotes[2] + (i % 10).toString(), c: quotes[4] },
        browsing_history: [quotes, quotes, quotes, quotes, quotes],

        // Fields towards the end of the object some of the tests will be using.
        order_month: Random.randInt(10),
        browsing_time: Random.randInt(1000),
        quantity: Random.rand() * 100 + 1,
        returned_date: i % 10000,
        tracking_details: {
            carrier: Random.randInt(10),
            carrier_phone: Random.randInt(1000),
            shipping_price: Random.rand() * 100 + 1,
            fulfillment_center: { u: Random.randInt(100), v: Random.randInt(100) },
            location_history: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
            back_order_date: Random.rand() * 10,
            weight_kg: Random.rand() * 1000,
            oversized: Random.rand() * 100000,
        },
        geography: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
        ship_date: Random.rand() * 10,
        shipping_speed: Random.rand() * 1000,
        delivery_datetime: Random.rand() * 100000,
    };
}
