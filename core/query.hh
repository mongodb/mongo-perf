#ifndef __MONGOPERF_GUARD_QUERYTEST__
#define __MONGOPERF_GUARD_QUERYTEST__

namespace Queries{
    class Base {
        public:
            bool readOnly() { return true; }
    };

    /*
     * Does one query using an empty pattern, then iterates over results.
     * The documents are inserted as empty objects.
     */
    class Empty : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                for (int i=0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSONObj());
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                int chunk = cc->getIterations() / n;
                auto_ptr<DBClientCursor> cursor = cc->query(t, BSONObj(), 
                    chunk, chunk*t);
                cursor->itcount();
            }
    };

    /*
     * Does a total of 100 queries (across threads) using a match on a nonexistent field, triggering table scans.
     * The documents are inserted as empty objects.
     */
    class HundredTableScans : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                for (int i=0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSONObj());
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc){
                for (int i=0; i < 100 / n; i++) {
                    cc->findOne(t, BSON("does_not_exist" << i));
                }
            }
    };

    /*
     * Does one query using an empty pattern, then iterates over results.
     * The documents are inserted with an incrementing integer id.
     */
    class IntID : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                for (int i=0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSON("_id" << i));
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                int chunk = cc->getIterations() / n;
                auto_ptr<DBClientCursor> cursor =
                    cc->query(t, BSONObj(), chunk, chunk*t);
                cursor->itcount();
            }
    };

    /*
     * Does one query using a range on the id, then iterates over results.
     * The documents are inserted with an incrementing integer id.
     */
    class IntIDRange : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                for (int i=0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSON("_id" << i));
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc){
                int chunk = cc->getIterations() / n;
                auto_ptr<DBClientCursor> cursor = 
                    cc->query(t, BSON("_id" << GTE << chunk*t << LT
                    << chunk*(t+1)));
                cursor->itcount();
            }
    };

    /*
     * Issues findOne queries with a match on id.
     * The documents are inserted with an incrementing integer id.
     */
    class IntIDFindOne : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                for (int i=0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSON("_id" << i));
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                int base = t * (cc->getIterations() / n);
                for (int i=0; i < cc->getIterations() / n; i++) {
                    cc->findOne(t, BSON("_id" << base + i));
                }
            }
    };

    /*
     * Does one query using an empty pattern, then iterates over results.
     * The documents are inserted with an incrementing integer field 'x' that is indexed.
     */
    class IntNonID : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                for (int i=0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSON("x" << i));
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                int chunk = cc->getIterations() / n;
                auto_ptr<DBClientCursor> cursor = 
                    cc->query(t, BSONObj(), chunk, chunk*t);
                cursor->itcount();
            }
    };

    /*
     * Does one query using a range on field 'x', then iterates over results.
     * The documents are inserted with an incrementing integer field 'x' that is indexed.
     */
    class IntNonIDRange : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                for (int i=0; i < cc->getIterations(); i++){
                    cc->insert(-1, BSON("x" << i));
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                int chunk = cc->getIterations() / n;
                auto_ptr<DBClientCursor> cursor = cc->query(t, 
                    BSON("x" << GTE << chunk*t << LT << chunk*(t+1)));
                cursor->itcount();
            }
    };

    /*
     * Issues findOne queries with a match on 'x' field.
     * The documents are inserted with an incrementing integer field 'x' that is indexed.
     */
    class IntNonIDFindOne : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                for (int i=0; i < cc->getIterations(); i++){
                    cc->insert(-1, BSON("x" << i));
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                int base = t * (cc->getIterations() / n);
                for (int i=0; i < cc->getIterations() / n; i++) {
                    cc->findOne(t, BSON("x" << base + i));
                }
            }
    };

    /*
     * Issues findOne queries with a left-rooted regular expression on the 'x' field.
     * The documents are inserted with an incrementing integer field 'x' that is converted to a string and indexed.
     */
    class RegexPrefixFindOne : public Base {
        public:
            RegexPrefixFindOne(){
                for (int i=0; i<100; i++)
                    nums[i] = "^" + BSONObjBuilder::numStr(i+1);
            }
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                for (int i=0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSON("x" << BSONObjBuilder::numStr(i)));
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                for (int i=0; i < cc->getIterations() / n / 100; i++) {
                    for (int j=0; j<100; j++) {
                        BSONObjBuilder b;
                        b.appendRegex("x", nums[j]);
                        cc->findOne(t, b.obj());
                    }
                }
            }
        private:
            string nums[100];
    };

    /*
     * Issues findOne queries with a match on 'x' and 'y' field.
     * The documents are inserted with an incrementing integer field 'x' and decrementing field 'y' that are indexed.
     */
    class TwoIntsBothGood : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                cc->ensureIndex(-1, BSON("y" << 1));
                for (int i=0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSON("x" << i << "y"
                        << (cc->getIterations() - i)));
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                int base = t * (cc->getIterations() / n);
                for (int i=0; i < cc->getIterations() / n; i++) {
                    cc->findOne(t, BSON("x" << base + i << "y" 
                        << (cc->getIterations() - (base + i))));
                }
            }
    };

    /*
     * Issues findOne queries with a match on 'x' and 'y' field.
     * The documents are inserted with an incrementing integer field 'x' and a field 'y' using modulo (low cardinality), that are indexed.
     */
    class TwoIntsFirstGood : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                cc->ensureIndex(-1, BSON("y" << 1));
                for (int i=0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSON("x" << i << "y" << (i%13)));
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                int base = t * (cc->getIterations() / n);
                for (int i=0; i < cc->getIterations() / n; i++) {
                    cc->findOne(t, BSON("x" << base + i << "y"
                        << ((base+i)%13)));
                }
            }
    };

    /*
     * Issues findOne queries with a match on 'x' and 'y' field.
     * The documents are inserted with a field 'x' using modulo (low cardinality) and an incrementing integer field 'y', that are indexed.
     */
    class TwoIntsSecondGood : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                cc->ensureIndex(-1, BSON("y" << 1));
                for (int i=0; i < cc->getIterations(); i++){
                    cc->insert(-1, BSON("x" << (i%13) << "y" << i));
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc){
                int base = t * (cc->getIterations() / n);
                for (int i=0; i < cc->getIterations() / n; i++){
                    cc->findOne(t, BSON("x" << ((base+i)%13) << 
                        "y" << base+i));
                }
            }
    };

    /*
     * Issues findOne queries with a match on 'x' and 'y' field.
     * The documents are inserted with fields 'x' and 'y' both using modulos (low cardinality)
     */
    class TwoIntsBothBad : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                cc->ensureIndex(-1, BSON("y" << 1));
                for (int i=0; i < cc->getIterations(); i++){
                    cc->insert(-1, BSON("x" << (i%503) << "y" << (i%509))); // both are prime
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc){
                int base = t * (cc->getIterations() / n);
                for (int i=0; i < cc->getIterations() / n; i++){
                    cc->findOne(t, BSON("x" << ((base+i)%503) << "y"
                        << ((base+i)%509)));
                }
            }
    };

    /*
     * Issues queries with a projection on the 'x' field and iterates the results
     * The documents are inserted with only the field 'x', so this should not project out anything
     */
    class ProjectionNoop : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                for (int i=0; i < cc->getIterations(); i++){
                    cc->insert(-1, BSON("x" << i));
                }
                cc->getLastError();
            }

            void run(int threadId, int totalThreads, Connection *cc) {
                int batchSize = cc->getIterations() / totalThreads;
                auto_ptr<DBClientCursor> cursor = cc->query(threadId,
                    BSON("x" << GTE << batchSize * threadId
                             << LT << batchSize * (threadId + 1)),
                    0, /* limit */
                    0, /* skip */
                    BSON("x" << 1) /* projection */);
                cursor->itcount();
            }
    };

    /*
     * Issues findOne queries with a projection on the 'x' field
     * The documents are inserted with only the field 'x', so this should not project out anything
     */
    class ProjectionNoopFindOne : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                for (int i=0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSON("x" << i));
                }
                cc->getLastError();
            }

            void run(int threadId, int totalThreads, Connection *cc) {
                int batchSize = cc->getIterations() / totalThreads;
                for (int i = threadId * batchSize;
                    i < (threadId + 1) * batchSize; i++){
                    cc->findOne(threadId, BSON("x" << i),
                        BSON("x" << 1));
                }
            }
    };

    /*
     * Issues queries with a projection on the 'x' field and iterates the results
     * The documents are inserted with the fields 'x' and 'y', so this should project out 'y'
     */
    class ProjectionSingle : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                for (int i=0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSON("x" << i << "y" << 1));
                }
                cc->getLastError();
            }

            void run(int threadId, int totalThreads, Connection *cc) {
                int batchSize = cc->getIterations() / totalThreads;
                auto_ptr<DBClientCursor> cursor = cc->query(threadId,
                    BSON("x" << GTE << batchSize * threadId
                             << LT << batchSize * (threadId + 1)),
                    0, /* limit */
                    0, /* skip */
                    BSON("x" << 1) /* projection */);
                cursor->itcount();
            }
    };

    /*
     * Issues findOne queries with a projection on the 'x' field
     * The documents are inserted with the fields 'x' and 'y', so this should project out 'y'
     */
    class ProjectionSingleFindOne : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                for (int i=0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSON("x" << i << "y" << 1));
                }
                cc->getLastError();
            }

            void run(int threadId, int totalThreads, Connection *cc) {
                int batchSize = cc->getIterations() / totalThreads;
                for (int i = threadId * batchSize;
                    i < (threadId + 1) * batchSize; i++) {
                    cc->findOne(threadId, BSON("x" << i),
                        BSON("x" << 1));
                }
            }
    };

    /*
     * Issues queries with a projection to remove the '_id' field and iterates the results
     * The documents are inserted with the field 'x, so this should project out '_id' and leave 'x'
     */
    class ProjectionUnderscoreId : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                for (int i=0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSON("x" << i));
                }
                cc->getLastError();
            }

            void run(int threadId, int totalThreads, Connection *cc) {
                int batchSize = cc->getIterations() / totalThreads;
                auto_ptr<DBClientCursor> cursor = cc->query(threadId,
                    BSON("x" << GTE << batchSize * threadId
                        << LT << batchSize * (threadId + 1)),
                        0, /* limit */
                        0, /* skip */
                        BSON("_id" << 0) /* projection */);
                cursor->itcount();
            }
    };

    /*
     * Issues findOne queries with a projection to remove the '_id' field
     * The documents are inserted with the field 'x, so this should project out '_id' and leave 'x'
     */
    class ProjectionUnderscoreIdFindOne : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                for (int i=0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSON("x" << i));
                }
                cc->getLastError();
            }

            void run(int threadId, int totalThreads, Connection *cc) {
                int batchSize = cc->getIterations() / totalThreads;
                for (int i = threadId * batchSize;
                    i < (threadId + 1) * batchSize; i++){
                    cc->findOne(threadId, BSON("x" << i),
                        BSON("_id" << 0));
                }
            }
    };

namespace {

    // Static array of field names to help with wide projection tests.  There should be 26 * 26 =
    // 676 distinct field names here.
    const std::string fieldNames[] = {
        "aa", "ba", "ca", "da", "ea", "fa", "ga", "ha", "ia", "ja", "ka", "la", "ma", "na", "oa",
        "pa", "qa", "ra", "sa", "ta", "ua", "va", "wa", "xa", "ya", "za", "ab", "bb", "cb", "db",
        "eb", "fb", "gb", "hb", "ib", "jb", "kb", "lb", "mb", "nb", "ob", "pb", "qb", "rb", "sb",
        "tb", "ub", "vb", "wb", "xb", "yb", "zb", "ac", "bc", "cc", "dc", "ec", "fc", "gc", "hc",
        "ic", "jc", "kc", "lc", "mc", "nc", "oc", "pc", "qc", "rc", "sc", "tc", "uc", "vc", "wc",
        "xc", "yc", "zc", "ad", "bd", "cd", "dd", "ed", "fd", "gd", "hd", "id", "jd", "kd", "ld",
        "md", "nd", "od", "pd", "qd", "rd", "sd", "td", "ud", "vd", "wd", "xd", "yd", "zd", "ae",
        "be", "ce", "de", "ee", "fe", "ge", "he", "ie", "je", "ke", "le", "me", "ne", "oe", "pe",
        "qe", "re", "se", "te", "ue", "ve", "we", "xe", "ye", "ze", "af", "bf", "cf", "df", "ef",
        "ff", "gf", "hf", "if", "jf", "kf", "lf", "mf", "nf", "of", "pf", "qf", "rf", "sf", "tf",
        "uf", "vf", "wf", "xf", "yf", "zf", "ag", "bg", "cg", "dg", "eg", "fg", "gg", "hg", "ig",
        "jg", "kg", "lg", "mg", "ng", "og", "pg", "qg", "rg", "sg", "tg", "ug", "vg", "wg", "xg",
        "yg", "zg", "ah", "bh", "ch", "dh", "eh", "fh", "gh", "hh", "ih", "jh", "kh", "lh", "mh",
        "nh", "oh", "ph", "qh", "rh", "sh", "th", "uh", "vh", "wh", "xh", "yh", "zh", "ai", "bi",
        "ci", "di", "ei", "fi", "gi", "hi", "ii", "ji", "ki", "li", "mi", "ni", "oi", "pi", "qi",
        "ri", "si", "ti", "ui", "vi", "wi", "xi", "yi", "zi", "aj", "bj", "cj", "dj", "ej", "fj",
        "gj", "hj", "ij", "jj", "kj", "lj", "mj", "nj", "oj", "pj", "qj", "rj", "sj", "tj", "uj",
        "vj", "wj", "xj", "yj", "zj", "ak", "bk", "ck", "dk", "ek", "fk", "gk", "hk", "ik", "jk",
        "kk", "lk", "mk", "nk", "ok", "pk", "qk", "rk", "sk", "tk", "uk", "vk", "wk", "xk", "yk",
        "zk", "al", "bl", "cl", "dl", "el", "fl", "gl", "hl", "il", "jl", "kl", "ll", "ml", "nl",
        "ol", "pl", "ql", "rl", "sl", "tl", "ul", "vl", "wl", "xl", "yl", "zl", "am", "bm", "cm",
        "dm", "em", "fm", "gm", "hm", "im", "jm", "km", "lm", "mm", "nm", "om", "pm", "qm", "rm",
        "sm", "tm", "um", "vm", "wm", "xm", "ym", "zm", "an", "bn", "cn", "dn", "en", "fn", "gn",
        "hn", "in", "jn", "kn", "ln", "mn", "nn", "on", "pn", "qn", "rn", "sn", "tn", "un", "vn",
        "wn", "xn", "yn", "zn", "ao", "bo", "co", "do", "eo", "fo", "go", "ho", "io", "jo", "ko",
        "lo", "mo", "no", "oo", "po", "qo", "ro", "so", "to", "uo", "vo", "wo", "xo", "yo", "zo",
        "ap", "bp", "cp", "dp", "ep", "fp", "gp", "hp", "ip", "jp", "kp", "lp", "mp", "np", "op",
        "pp", "qp", "rp", "sp", "tp", "up", "vp", "wp", "xp", "yp", "zp", "aq", "bq", "cq", "dq",
        "eq", "fq", "gq", "hq", "iq", "jq", "kq", "lq", "mq", "nq", "oq", "pq", "qq", "rq", "sq",
        "tq", "uq", "vq", "wq", "xq", "yq", "zq", "ar", "br", "cr", "dr", "er", "fr", "gr", "hr",
        "ir", "jr", "kr", "lr", "mr", "nr", "or", "pr", "qr", "rr", "sr", "tr", "ur", "vr", "wr",
        "xr", "yr", "zr", "as", "bs", "cs", "ds", "es", "fs", "gs", "hs", "is", "js", "ks", "ls",
        "ms", "ns", "os", "ps", "qs", "rs", "ss", "ts", "us", "vs", "ws", "xs", "ys", "zs", "at",
        "bt", "ct", "dt", "et", "ft", "gt", "ht", "it", "jt", "kt", "lt", "mt", "nt", "ot", "pt",
        "qt", "rt", "st", "tt", "ut", "vt", "wt", "xt", "yt", "zt", "au", "bu", "cu", "du", "eu",
        "fu", "gu", "hu", "iu", "ju", "ku", "lu", "mu", "nu", "ou", "pu", "qu", "ru", "su", "tu",
        "uu", "vu", "wu", "xu", "yu", "zu", "av", "bv", "cv", "dv", "ev", "fv", "gv", "hv", "iv",
        "jv", "kv", "lv", "mv", "nv", "ov", "pv", "qv", "rv", "sv", "tv", "uv", "vv", "wv", "xv",
        "yv", "zv", "aw", "bw", "cw", "dw", "ew", "fw", "gw", "hw", "iw", "jw", "kw", "lw", "mw",
        "nw", "ow", "pw", "qw", "rw", "sw", "tw", "uw", "vw", "ww", "xw", "yw", "zw", "ax", "bx",
        "cx", "dx", "ex", "fx", "gx", "hx", "ix", "jx", "kx", "lx", "mx", "nx", "ox", "px", "qx",
        "rx", "sx", "tx", "ux", "vx", "wx", "xx", "yx", "zx", "ay", "by", "cy", "dy", "ey", "fy",
        "gy", "hy", "iy", "jy", "ky", "ly", "my", "ny", "oy", "py", "qy", "ry", "sy", "ty", "uy",
        "vy", "wy", "xy", "yy", "zy", "az", "bz", "cz", "dz", "ez", "fz", "gz", "hz", "iz", "jz",
        "kz", "lz", "mz", "nz", "oz", "pz", "qz", "rz", "sz", "tz", "uz", "vz", "wz", "xz", "yz",
        "zz"
    };

    // Helper template to get the number of elements in the fieldNames array in a cross platform way
    template <typename T, size_t N>
    size_t countof( T (&array)[N] )
    {
        return N;
    };
}

    /*
     * Issues queries with a projection on the 'key' field and iterates the results
     * The documents are inserted with many fields, so this should project out all of them but "key"
     * and "_id"
     */
    class ProjectionWideDocNarrowProjection : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("key" << 1));
                for (int i=0; i < cc->getIterations(); i++) {
                    // NOTE: This will be slow, but this part of the 
                    // test is not timed, so that's ok
                    BSONObjBuilder b;
                    b.append("key", i);
                    for (int j=0; j < countof(fieldNames); j++) {
                        b.append(fieldNames[j], 1);
                    }
                    cc->insert(-1, b.obj());
                }
                cc->getLastError();
            }

            void run(int threadId, int totalThreads, Connection *cc) {
                int batchSize = cc->getIterations() / totalThreads;
                auto_ptr<DBClientCursor> cursor = cc->query(threadId,
                    BSON("key" << GTE << batchSize * threadId
                        << LT << batchSize * (threadId + 1)),
                        0, /* limit */
                        0, /* skip */
                        BSON("key" << 1) /* projection */);
                cursor->itcount();
            }
    };

    /*
     * Issues findOne queries with a projection on the 'key' field
     * The documents are inserted with many fields, so this should project out all of them but "key"
     * and "_id"
     */
    class ProjectionWideDocNarrowProjectionFindOne : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("key" << 1));
                for (int i=0; i < cc->getIterations(); i++) {
                    // NOTE: This will be slow, but this part of the test 
                    // is not timed, so that's ok
                    BSONObjBuilder b;
                    b.append("key", i);
                    for (int j=0; j < countof(fieldNames); j++) {
                        b.append(fieldNames[j], 1);
                    }
                    cc->insert(-1, b.obj());
                }
                cc->getLastError();
            }

            void run(int threadId, int totalThreads, Connection *cc) {
                int batchSize = cc->getIterations() / totalThreads;
                for (int i = threadId * batchSize;
                    i < (threadId + 1) * batchSize; i++) {
                    cc->findOne(threadId, BSON("key" << i),
                        BSON("key" << 1));
                }
            }
    };

    /*
     * Issues queries with a projection excluding the 'key' field and iterates the results
     * The documents are inserted with many fields, so this should include all of them but "key"
     */
    class ProjectionWideDocWideProjection : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("key" << 1));
                for (int i=0; i < cc->getIterations(); i++) {
                    // NOTE: This will be slow, but this part of the test 
                    // is not timed, so that's ok
                    BSONObjBuilder b;
                    b.append("key", i);
                    for (int j=0; j < countof(fieldNames); j++) {
                        b.append(fieldNames[j], 1);
                    }
                    cc->insert(-1, b.obj());
                }
                cc->getLastError();
            }

            void run(int threadId, int totalThreads, Connection *cc) {
                int batchSize = cc->getIterations() / totalThreads;
                auto_ptr<DBClientCursor> cursor = cc->query(threadId,
                    BSON("key" << GTE << batchSize * threadId
                        << LT << batchSize * (threadId + 1)),
                        0, /* limit */
                        0, /* skip */
                        BSON("key" << 0) /* projection */);
                cursor->itcount();
            }
    };

    /*
     * Issues findOne queries with a projection excluding the 'key' field
     * The documents are inserted with many fields, so this should include all of them but "key"
     */
    class ProjectionWideDocWideProjectionFindOne : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("key" << 1));
                for (int i=0; i < cc->getIterations(); i++) {
                    // NOTE: This will be slow, but this part of the test 
                    // is not timed, so that's ok
                    BSONObjBuilder b;
                    b.append("key", i);
                    for (int j=0; j < countof(fieldNames); j++) {
                        b.append(fieldNames[j], 1);
                    }
                    cc->insert(-1, b.obj());
                }
                cc->getLastError();
            }

            void run(int threadId, int totalThreads, Connection *cc) {
                int batchSize = cc->getIterations() / totalThreads;
                for (int i = threadId * batchSize; 
                    i < (threadId + 1) * batchSize; i++){
                    cc->findOne(threadId, BSON("key" << i),
                        BSON("key" << 0));
                }
            }
    };

// XXX: move away.
namespace {
    // Helper class for building and projecting deeply nested document
    class NestedProjectionTests : public Base {
        public:
            std::string projectionKey;

            // Depth of nested document to insert
            virtual int nestedDepth() = 0;

            // Depth of document to exclude
            virtual int projectionDepth() = 0;

            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("key" << 1));
                projectionKey = buildNestedProjectionKey(projectionDepth());
                for (int i=0; i < cc->getIterations(); i++) {
                    // NOTE: This will be slow, but this part of the test is
                    // not timed, so that's ok
                    BSONObjBuilder b;
                    b.append("key", i);
                    addNestedDocument(nestedDepth(), &b);
                    cc->insert(-1, b.obj());
                }
                cc->getLastError();
            }

            virtual void run(int threadId, int totalThreads,
                Connection *cc) = 0;

            // Adds a nested document of depth "depth" to the given builder.
            void addNestedDocument(int depth, BSONObjBuilder *builder) {
                if (depth == 0) {
                    return;
                }
                BSONObjBuilder nextBuilder(builder->subobjStart("a"));
                addNestedDocument(depth - 1, &nextBuilder);
                nextBuilder.done();
                builder->append("b", 1);
                return;
            }

            // Returns a string referencing an element at "depth". 
            // Should use the same or lesser "depth" as
            // what was passed into the function above.
            std::string buildNestedProjectionKey(int depth) {
                if (depth == 1) {
                    return "a";
                }
                else {
                    return std::string("a.").append(
                        buildNestedProjectionKey(depth - 1));
                }
            }
    };

    template<int ProjectionDepth, int DocumentDepth>
    class NestedProjectionFindOne : public NestedProjectionTests {
        
        private:
            int nestedDepth() {
                return DocumentDepth;
            }

            int projectionDepth() {
                return ProjectionDepth;
            }

        public:
            void run(int threadId, int totalThreads, Connection *cc) {
                int batchSize = cc->getIterations() / totalThreads;
                for (int i = threadId * batchSize;
                    i < (threadId + 1) * batchSize; i++) {
                    cc->findOne(threadId, BSON("key" << i),
                        BSON(projectionKey << 0));
                }
            }
    };

    template<int ProjectionDepth, int DocumentDepth>
    class NestedProjectionCursor : public NestedProjectionTests {

        private:
            int nestedDepth() {
                return DocumentDepth;
            }

            int projectionDepth() {
                return ProjectionDepth;
            }

        public:
            void run(int threadId, int totalThreads, Connection *cc) {
                int batchSize = cc->getIterations() / totalThreads;
                auto_ptr<DBClientCursor> cursor = cc->query(threadId,
                    BSON("key" << GTE << batchSize * threadId
                        << LT << batchSize * (threadId + 1)),
                        0, /* limit */
                        0, /* skip */
                        BSON(projectionKey << 0) /* projection */);
                cursor->itcount();
            }
    };

}

    /*
     * Issues queries with an $elemMatch projection on the { 'x' : 2 } document and iterates the
     * results
     */
    class ProjectionElemMatch : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                for (int i=0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSON("x" << i <<
                                        "arr" << BSON_ARRAY(
                        BSON("x" << 1) <<
                        BSON("x" << 2) <<
                        BSON("x" << 3))));
                }
                cc->getLastError();
            }

            void run(int threadId, int totalThreads, Connection *cc) {
                int batchSize = cc->getIterations() / totalThreads;
                auto_ptr<DBClientCursor> cursor = cc->query(threadId,
                    BSON("x" << GTE << batchSize * threadId
                        << LT << batchSize * (threadId + 1)),
                        0, /* limit */
                        0, /* skip */
                        BSON("arr" <<
                        BSON("$elemMatch" <<
                        BSON("x" << 2))) /* projection */);
                cursor->itcount();
            }
    };

    /*
     * Issues findOne queries with an $elemMatch projection on the { 'x' : 2 } document
     */
    class ProjectionElemMatchFindOne : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                for (int i=0; i < cc->getIterations(); i++){
                    cc->insert(-1, BSON("x" << i <<
                                        "arr" << BSON_ARRAY(
                        BSON("x" << 1) <<
                        BSON("x" << 2) <<
                        BSON("x" << 3))));
                }
                cc->getLastError();
            }

            void run(int threadId, int totalThreads, Connection *cc) {
                int batchSize = cc->getIterations() / totalThreads;
                for (int i = threadId * batchSize;
                    i < (threadId + 1) * batchSize; i++){
                    cc->findOne(threadId, BSON("x" << i),
                        BSON("arr" << BSON("$elemMatch" <<
                        BSON("x" << 2))));
                }
            }
    };

}

#endif // __MONGOPERF_GUARD_QUERYTEST__

