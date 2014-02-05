#ifndef __MONGOPERF_GUARD_REMOVETEST__
#define __MONGOPERF_GUARD_REMOVETEST__

namespace Remove {
    class Base {
        public:
            bool readOnly() { return false; };
    };

    class IntID: public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                for (int i = 0; i < cc->getIterations(); ++i) {
                    cc->insert(-1, BSON("_id" << i));
                }
                cc->getLastError();
            }
     
            void run(int t, int n, Connection *cc) {
                int base = t * (cc->getIterations() / n);
                for (int i = 0; i < cc->getIterations() / n; ++i) {
                    cc->remove(t, BSON("_id" << base + i));
                }
            }
    };

     class IntIDRange : public Base {
         public:
            void reset(Connection *cc) {
                cc->clearDB();
                for (int i = 0; i < cc->getIterations(); ++i) {
                    cc->insert(-1, BSON("_id" << i));
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                int chunk = cc->getIterations() / n;
                cc->remove(t, BSON("_id" << GTE << chunk * t 
                                    << LT << chunk * (t + 1)));
            }
    };

    class IntNonID: public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                for (int i = 0; i < cc->getIterations(); ++i) {
                    cc->insert(-1, BSON("x" << i));
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                int base = t * (cc->getIterations() / n);
                for (int i = 0; i < cc->getIterations() / n; ++i) {
                    cc->remove(t, BSON("x" << base + i));
                }
            }
    };

    class IntNonIDRange: public Base {
        public:
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                for (int i = 0; i < cc->getIterations(); ++i) {
                    cc->insert(-1, BSON("x" << i));
                }
                cc->getLastError();
            }

            void run(int t, int n, Connection *cc) {
                int chunk = cc->getIterations() / n;
                cc->remove(t, BSON("x" << GTE << chunk * t
                                << LT << chunk * (t + 1)));
            }
    };
}

#endif // __MONGOPERF_GUARD_REMOVETEST__
