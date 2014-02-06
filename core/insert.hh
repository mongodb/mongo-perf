#pragma once

namespace Insert {
    class Base {
        public:
            bool readOnly() { return false; }
            void reset(Connection *cc){ cc->clearDB(); }
    };

    /*
     * inserts empty documents.
     */
    class Empty : public Base {
        public:
            void run(int t, int n, Connection *cc) {
                for (int i=0; i < cc->getIterations() / n; i++) {
                    cc->insert(t, BSONObj());
                }
            }
    };

    /*
     * inserts batches of empty documents.
     */

    template <int BatchSize>
    class EmptyBatched : public Base {
        public:
            void run(int t, int n, Connection *cc) {
                for (int i=0; i < cc->getIterations() / BatchSize / n; 
                    i++) {
                    vector<BSONObj> objs(BatchSize);
                    cc->insert(t, objs);
                }
            }
    };

    /*
     * inserts empty documents into capped collections.
     */
    class EmptyCapped : public Base {
        public:
            void run(int t, int n, Connection *cc) {
                for (int i=0; i < cc->getIterations() / n; i++){
                    cc->insert(t, BSONObj());
                }
            }
            void reset(Connection *cc){
                cc->clearDB();
                for (int t=0; t<max_threads; t++){
                    cc->createCollection(t, 32 * 1024, true);
                    if (!cc->getMultiDB())
                        return;
                }
            }
    };

    /*
     * inserts documents just containing the field '_id' as an ObjectId.
     */
    class JustID : public Base {
        public:
            void run(int t, int n, Connection *cc) {
                for (int i=0; i < cc->getIterations() / n; i++){
                    BSONObjBuilder b;
                    b << GENOID;
                    cc->insert(t, b.obj());
                }
            }
    };

    /*
     * inserts documents just containing the field '_id' as an incrementing integer.
     */
    class IntID : public Base {
        public:
            void run(int t, int n, Connection *cc) {
                int base = t * (cc->getIterations() / n);
                for (int i=0; i < cc->getIterations() / n; i++){
                    cc->insert(t, BSON("_id" << base + i));
                }
            }
    };

    /*
     * upserts documents just containing the field '_id' as an incrementing integer.
     */
    class IntIDUpsert : public Base {
        public:
            void run(int t, int n, Connection *cc) {
                int base = t * (cc->getIterations() / n);
                for (int i=0; i < cc->getIterations() / n; i++) {
                    cc->update(t, BSON("_id" << base + i), BSONObj(), 
                        true);
                }
            }
    };

    /*
     * inserts documents just containing the field 'x' as an incrementing integer.
     */
    class JustNum : public Base {
        public:
            void run(int t, int n, Connection *cc) {
                int base = t * (cc->getIterations() / n);
                for (int i=0; i < cc->getIterations() / n; i++) {
                    cc->insert(t, BSON("x" << base + i));
                }
            }
    };

    /*
     * inserts documents just containing the field 'x' as an incrementing integer.
     * An index on 'x' is created before the run.
     */
    class JustNumIndexedBefore : public Base {
        public:
            void run(int t, int n, Connection *cc) {
                cc->ensureIndex(t, BSON("x" << 1));
                int base = t * (cc->getIterations() / n);
                for (int i=0; i < cc->getIterations() / n; i++) {
                    cc->insert(t, BSON("x" << base + i));
                }
            }
    };

    /*
     * inserts documents just containing the field 'x' as an incrementing integer.
     * An index on 'x' is created after the run.
     */
    class JustNumIndexedAfter : public Base {
        public:
            void run(int t, int n, Connection *cc) {
                int base = t * (cc->getIterations() / n);
                for (int i=0; i < cc->getIterations() / n; i++){
                    cc->insert(t, BSON("x" << base + i));
                }
                cc->ensureIndex(t, BSON("x" << 1));
            }
    };

    /*
     * inserts documents containing the field '_id' as an ObjectId and 
     * the field 'x' as an incrementing integer.
     */
    class NumAndID : public Base {
        public:
            void run(int t, int n, Connection *cc) {
                int base = t * (cc->getIterations() / n);
                for (int i=0; i < cc->getIterations() / n; i++){
                    BSONObjBuilder b;
                    b << GENOID;
                    b << "x" << base+i;
                    cc->insert(t, b.obj());
                }
            }
    };
}

