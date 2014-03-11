#pragma once

namespace Update {
    class Base {
        public:
            bool readOnly() { return false; }
            void reset(Connection *cc){ cc->clearDB(); }
    };

    /*
     * Upserts 100 distinct documents based on an incrementing integer id.
     * For each document the '$inc' operator is called multiple times to increment the field 'count'.
     */
    class IncNoIndexUpsert : public Base {
        public:
            void run(int t, int n, Connection *cc) {
                const int incs = cc->getIterations() / n / 100;
                for (int i=0; i<100; i++){
                    for (int j=0; j<incs; j++) {
                        cc->update(t, BSON("_id" << i),
                            BSON("$inc" << BSON("count" << 1)), 1);
                    }
                }
            }
    };

    /*
     * Upserts 100 distincts documents based on an incrementing integer id.
     * For each document the '$inc' operator is called multiple times to increment the field 'count'.
     * An index on 'count' is created before the run.
     */
    class IncWithIndexUpsert : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("count" << 1));
            }
            void run(int t, int n, Connection *cc) {
                const int incs = cc->getIterations() / n / 100;
                for (int i=0; i<100; i++){
                    for (int j=0; j<incs; j++){
                        cc->update(t, BSON("_id" << i), 
                            BSON("$inc" << BSON("count" << 1)), 1);
                    }
                }
            }
    };

    /*
     * Inserts 100 documents with an incrementing integer id and a 'count' field.
     * For each document an update with the '$inc' operator is called multiple times to increment the field 'count'.
     */
    class IncNoIndex : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB(); 
                for (int i=0; i<100; i++)
                    cc->insert(-1, BSON("_id" << i << "count" << 0));
            }
            void run(int t, int n, Connection *cc) {
                const int incs = cc->getIterations() / n / 100;
                for (int i=0; i<100; i++) {
                    for (int j=0; j<incs; j++) {
                        cc->update(t, BSON("_id" << i),
                            BSON("$inc" << BSON("count" << 1)));
                    }
                }
            }
    };

    /*
     * Inserts 100 documents with an incrementing integer id and a 'count' field.
     * For each document an update with the '$inc' operator is called multiple times to increment the field 'count'.
     * An index on 'count' is created before the run.
     */
    class IncWithIndex : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB(); 
                cc->ensureIndex(-1, BSON("count" << 1));
                for (int i=0; i<100; i++)
                    cc->insert(-1, BSON("_id" << i << "count" << 0));
            }
            void run(int t, int n, Connection *cc) {
                const int incs = cc->getIterations() / n / 100;
                for (int i=0; i<100; i++) {
                    for (int j=0; j<incs; j++) {
                        cc->update(t, BSON("_id" << i),
                            BSON("$inc" << BSON("count" << 1)));
                    }
                }
            }
    };

    /*
     * Inserts 100 documents with an incrementing integer id, a field 'i' equals to the id, and a 'count' field.
     * For each document an update with the '$inc' operator is called multiple times to increment the field 'count', using a query on 'i'.
     * An index on 'i' is created before the run.
     */
    class IncNoIndex_QueryOnSecondary : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB(); 
                cc->ensureIndex(-1, BSON("i" << 1));
                for (int i=0; i<100; i++)
                    cc->insert(-1, BSON("_id" << i << "i" << i 
                        << "count" << 0));
            }
            void run(int t, int n, Connection *cc) {
                const int incs = cc->getIterations() / n / 100;
                for (int i=0; i<100; i++) {
                    for (int j=0; j<incs; j++){
                        cc->update(t, BSON("i" << i),
                            BSON("$inc" << BSON("count" << 1)));
                    }
                }
            }
    };

    /*
     * Inserts 100 documents with an incrementing integer id, a field 'i' equals to the id, and a 'count' field.
     * For each document an update with the '$inc' operator is called multiple times to increment the field 'count', using a query on 'i'.
     * Indexes on 'i' and 'count' are created before the run.
     */
    class IncWithIndex_QueryOnSecondary : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB(); 
                cc->ensureIndex(-1, BSON("count" << 1));
                cc->ensureIndex(-1, BSON("i" << 1));
                for (int i=0; i<100; i++)
                    cc->insert(-1, BSON("_id" << i << "i" << i 
                        << "count" << 0));
            }
            void run(int t, int n, Connection *cc) {
                const int incs = cc->getIterations() / n / 100;
                for (int i=0; i<100; i++) {
                    for (int j=0; j<incs; j++) {
                        cc->update(t, BSON("i" << i),
                            BSON("$inc" << BSON("count" << 1)));
                    }
                }
            }
    };

namespace {
    const std::string shortFieldNames[] = {
        "aa", "ba", "ca", "da", "ea", "fa", "ga", "ha", "ia", "ja", "ka", "la", "ma", "na", "oa",
        "pa", "qa", "ra", "sa", "ta", "ua", "va", "wa", "xa", "ya", "za", "ab", "bb", "cb", "db",
        "ri", "si", "ti", "ui", "vi", "wi", "xi", "yi", "zi", "aj", "xm", "ym", "zm", "an", "bn",
        "cn", "dn", "en", "fn", "gn"
    };

    const std::string longFieldsNames[] = {
        "kbgcslcybg", "kfexqflvce", "yitljbmriy", "vjhgznppgw", "ksnqrkckgm", "bxzrekmanf",
        "wgjptieoho", "miohmkbzvv", "iyymqfqfte", "nbbxrjspyu", "ftdmqxfvfo", "sqoccqelhp",
        "phbgzfvlvm", "ygvlusahma", "elcgijivrt", "qdwzjpugsr", "dhwgzxijck", "ezbztosivn",
        "gqnevrxtke", "jyzymmhtxc", "iqzleodwcl", "uvcbevobia", "fmsaehzaax", "hvekxgvche",
        "mudggeguxy", "jkpwpdfjjq", "ziujorptwj", "zygklvogup", "rtxpmvlegv", "nfzarcgpmf",
        "nlvbsgscbz", "yanwvoxeov", "ylqapkyfxn", "evlwtlejoe", "xvkejgtiuc", "sjkwfnrwpf",
        "gobpjhjrck", "ltpkggsgpb", "jzaathnsra", "uqiutzbcoa", "zwivxvtmgi", "glaibvnhix",
        "dosiyispnf", "nvtaemdwtp", "vzojziqbkj", "kbtfmcjlgl", "ialgxzuhnq", "djqfxvmycc",
        "ocrpwmeqyb", "tcrrliflby"
    };

    // Helper template to get the number of elements in the fieldNames array in a cross platform way
    template <typename T, size_t N>
    size_t countof( T (&array)[N] )
    {
        return N;
    };

} // anonymous namespace

    class IncFewSmallDoc: public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                for (int i = 0; i < 100; ++i) {
                    BSONObjBuilder b;
                    b.append("_id", i);
                    for (int j = 0; j < 20; ++j) {
                        b.append(shortFieldNames[j], 1);
                    }
                    cc->insert(-1, b.obj());
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                const int incs = cc->getIterations() / n / 100;
                for (int i = 0; i < 100; ++i) {
                    for (int j = 0; j < incs; ++j) {
                        // XXX: This might use a BSONObj builder,
                        // but that would be slow.
                        // Let's hardcode the fields instead.
                        cc->update(t, BSON("_id" << i),
                                      BSON("$inc" << BSON("aa" << 1 <<
                                                          "da" << 1 <<
                                                          "ha" << 1 <<
                                                          "ma" << 1 <<
                                                          "ta" << 1)));
                    }
                }
            }
    };

    class IncFewLargeDoc: public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                for (int i = 0; i < 100; ++i) {
                    BSONObjBuilder b;
                    b.append("_id", i);
                    for (int j = 0; j < countof(shortFieldNames); ++j) {
                        b.append(shortFieldNames[j], 1);
                    }
                    cc->insert(-1, b.obj());
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                const int incs = cc->getIterations() / n / 100;
                for (int i = 0; i < 100; ++i) {
                    for (int j = 0; j < incs; ++j) {
                        // XXX: This might use a BSONObj builder,
                        // but that would be slow.
                        // Let's hardcode the fields instead.
                        cc->update(t, BSON("_id" << i),
                                      BSON("$inc" << BSON("aa" << 1 <<
                                                          "wa" << 1 <<
                                                          "xi" << 1 <<
                                                          "zm" << 1 <<
                                                          "gn" << 1)));
                    }
                }
            }
    };

    class IncFewSmallDocLongFields: public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                for (int i = 0; i < 100; ++i) {
                    BSONObjBuilder b;
                    b.append("_id", i);
                    for (int j = 0; j < 20; ++j) {
                        b.append(longFieldsNames[j], 1);
                    }
                    cc->insert(-1, b.obj());
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                const int incs = cc->getIterations() / n / 100;
                for (int i = 0; i < 100; ++i) {
                    for (int j = 0; j < incs; ++j) {
                        // XXX: This might use a BSONObj builder,
                        // but that would be slow.
                        // Let's hardcode the fields instead.
                        cc->update(t, BSON("_id" << i),
                                      BSON("$inc" << BSON("kbgcslcybg" << 1 <<
                                                          "vjhgznppgw" << 1 <<
                                                          "jzaathnsra" << 1 <<
                                                          "miohmkbzvv" << 1 <<
                                                          "elcgijivrt" << 1)));
                    }
                }
            }

    };

    class IncFewLargeDocLongFields: public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                for (int i = 0; i < 100; ++i) {
                    BSONObjBuilder b;
                    b.append("_id", i);
                    for (int j = 0; j < countof(longFieldsNames); ++j) {
                        b.append(longFieldsNames[j], 1);
                    }
                    cc->insert(-1, b.obj());
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                const int incs = cc->getIterations() / n / 100;
                for (int i = 0; i < 100; ++i) {
                    for (int j = 0; j < incs; ++j) {
                        // XXX: This might use a BSONObj builder,
                        // but that would be slow.
                        // Let's hardcode the fields instead.
                        cc->update(t, BSON("_id" << i),
                                      BSON("$inc" << BSON("kbgcslcybg" << 1 <<
                                                          "qdwzjpugsr" << 1 <<
                                                          "yanwvoxeov" << 1 <<
                                                          "jzaathnsra" << 1 <<
                                                          "tcrrliflby" << 1)));
                    }
                }
            }

    };

    // CAP-105: Update a single field large flat documents.
    // @param fieldIdToUpdate   0-based field id to update in range [0, kFieldCount)
    template <int fieldIdToUpdate>
    class FieldAtOffset : public Base {
    public:
        void reset(Connection *cc) {
            const int kFieldCount = 512;
            BOOST_STATIC_ASSERT(fieldIdToUpdate < kFieldCount);
            cc->clearDB();
            BSONObjBuilder b;

            // generate the document
            for (int i = 0; i < kFieldCount; ++i) {
                stringstream s;
                s << "a_" << i;
                b.append(s.str(), "a");
            }
            BSONObj doc = b.obj().getOwned();

            // insert 100 documents.  ideally this would only update a single document,
            // however mongo-perf doesn't have the require time resolution.
            for (int i = 0; i < 100; i++)
                cc->insert(-1, doc);
            cc->getLastError();

            // precompute the query and update specifier
            stringstream fieldName;
            fieldName << "a_" << fieldIdToUpdate;
            updateSpec1 = BSON("$set" << BSON(fieldName.str() << "a"));
            updateSpec2 = BSON("$set" << BSON(fieldName.str() << "aa"));
        }

        void run(int t, int n, Connection *cc) {
            // update a single field in every document
            cc->update(t, querySpec, updateSpec2, false, true);
            cc->update(t, querySpec, updateSpec1, false, true);
        }

    private:
        BSONObj querySpec;
        BSONObj updateSpec1;
        BSONObj updateSpec2;
    };

    // Some tests based on the MMS workload. These started as Eliot's 'mms.js' tests, which acm
    // then extended and used for the first round of update performance improvements. We are
    // capturing them here so they are run automatically. These tests explore the overhead of
    // reaching into deep right children in complex documents.
    class MMSBase : public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();

                // It is easier to see what is going on here by reading it as javascript, below
                // is a translation of:
                //
                // var base = { a : 0, h : {}, z : 0 };
                // for ( h=0; h<24; h++ ) {
                //     base.h[h] = {};
                //     for ( min=0; min<60; min++ ) {
                //         base.h[h][min] = { n : 0 , t : 0, v : 0 };
                //     }
                // }
                //
                // This gives us documents with a very high branching factor and fairly deep
                // object structure.

                int zero = 0;
                BSONObjBuilder docBuilder;
                docBuilder.append("_id", 0);
                docBuilder.append("a", zero);
                BSONObjBuilder hBuilder(docBuilder.subobjStart("h"));
                for (int h = 0; h != 24; ++h) {
                    std::string hStr = boost::lexical_cast<std::string>(h);
                    BSONObjBuilder mBuilder(hBuilder.subobjStart(hStr));
                    for (int m = 0; m != 60; ++m) {
                        std::string mStr = boost::lexical_cast<std::string>(m);
                        BSONObjBuilder leafBuilder(mBuilder.subobjStart(mStr));
                        leafBuilder.append("n", zero);
                        leafBuilder.append("t", zero);
                        leafBuilder.append("v", zero);
                        leafBuilder.doneFast();
                    }
                    mBuilder.doneFast();
                }
                hBuilder.doneFast();
                docBuilder.append("z", zero);
                cc->insert(-1, docBuilder.done());
                cc->getLastError();
            }
    };

    /*
     * Increment one shallow (top level) fields
     */
    class MmsIncShallow1 : public MMSBase {
        public:
            void run(int t, int n, Connection *cc) {
                const int ops = cc->getIterations() / n;
                for (int op = 0; op != ops; ++op) {
                    cc->update(t, BSON("_id" << 0),
                           BSON("$inc" <<
                                BSON("a" << 1)));
                }
            }
    };

    /*
     * Increment two shallow (top level) fields.
     */
    class MmsIncShallow2 : public MMSBase {
        public:
            void run(int t, int n, Connection *cc) {
                const int ops = cc->getIterations() / n;
                for (int op = 0; op != ops; ++op) {
                    cc->update(t, BSON("_id" << 0),
                           BSON("$inc" <<
                                BSON("a" << 1 <<
                                     "z" << 1)));
                }
            }
    };

    /*
     * Increment one deep field. The selected field is far to the right in each subtree.
     */
    class MmsIncDeep1 : public MMSBase {
        public:
            void run(int t, int n, Connection *cc) {
                const int ops = cc->getIterations() / n;
                for (int op = 0; op != ops; ++op) {
                    cc->update(t, BSON("_id" << 0),
                           BSON("$inc" <<
                                BSON("h.23.59.n" << 1)));
                }
            }
    };

    /*
     * Increment two deep fields. The selected fields are far to the right in each subtree, and
     * share a common prefix.
     */
    class MmsIncDeepSharedPath2 : public MMSBase {
        public:
            void run(int t, int n, Connection *cc) {
                const int ops = cc->getIterations() / n;
                for (int op = 0; op != ops; ++op) {
                    cc->update(t, BSON("_id" << 0),
                           BSON("$inc" <<
                                BSON("h.23.59.n" << 1 <<
                                     "h.23.59.t" << 1)));
                }
            }
    };

    /*
     * Increment three deep fields. The selected fields are far to the right in each subtree,
     * and share a common prefix.
     */
    class MmsIncDeepSharedPath3 : public MMSBase {
        public:
            void run(int t, int n, Connection *cc) {
                const int ops = cc->getIterations() / n;
                for (int op = 0; op != ops; ++op) {
                    cc->update(t, BSON("_id" << 0),
                           BSON("$inc" <<
                                BSON("h.23.59.n" << 1 <<
                                     "h.23.59.t" << 1 <<
                                     "h.23.59.v" << 1)));
                }
            }
    };

    /*
     * Increment two deep fields. The selected fields are far to the right in each subtree, but
     * do not share a common prefix.
     */
    class MmsIncDeepDistinctPath2 : public MMSBase {
        public:
            void run(int t, int n, Connection *cc) {
                const int ops = cc->getIterations() / n ;
                for (int op = 0; op != ops; ++op) {
                    cc->update(t, BSON("_id" << 0),
                           BSON("$inc" <<
                                BSON("h.22.59.n" << 1 <<
                                     "h.23.59.t" << 1)));
                }
            }
    };

    /*
     * Increment three deep fields. The selected fields are far to the right in each subtree,
     * but do not share a common prefix.
     */
    class MmsIncDeepDistinctPath3 : public MMSBase {
        public:
            void run(int t, int n, Connection *cc) {
                const int ops = cc->getIterations() / n;
                for (int op = 0; op != ops; ++op) {
                    cc->update(t, BSON("_id" << 0),
                           BSON("$inc" <<
                                BSON("h.21.59.n" << 1 <<
                                     "h.22.59.t" << 1 <<
                                     "h.23.59.v" << 1)));
                }
            }
    };


}

