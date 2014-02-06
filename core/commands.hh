#pragma once

#include "util.hh"

using namespace utils;

namespace Commands {
 
    /*
     * Performs a count command to get the total number of documents in the collection
     */
    class CountsFullCollection {
        public:
            bool readOnly() { return true; }
            void reset(Connection *cc) {
                cc->clearDB();
                for (int i = 0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSONObj());
                }
                cc->getLastError();
            }
            void run(int t, int n, Connection *cc) {
                for (int i = 0; i < cc->getIterations() / n; i++) {
                    cc->command(t, BSON("count" << _coll));
                }
            }
    };

    /*
     * Performs a count using a range on the id.
     * The documents are inserted with an incrementing integer id.
     */
    class CountsIntIDRange {
        public:
            bool readOnly() { return true; }
            void reset(Connection *cc) {
                cc->clearDB();
                for (int i=0; i < cc->getIterations(); i++){
                    cc->insert(-1, BSON("_id" << i));
                }
                cc->getLastError();
            }
            void run(int t, int n, Connection *cc) {
                int chunk = cc->getIterations() / n;
                cc->command(t, BSON("count" << _coll <<
                                "query" << BSON("_id" << GTE << 
                                chunk * t << LT << chunk * (t+1))));
            }
    };

    /*
     * Uses findAndModify to insert documents containing _id as an incrementing integer
     */
    class FindAndModifyInserts {
        public:
            bool readOnly() { return false; }
            void reset(Connection *cc) { cc->clearDB(); }
            void run(int t, int n, Connection *cc) {
                int base = t * (cc->getIterations() / n);
                for (int i = 0; i < cc->getIterations() / n; i++) {
                    cc->command(t, BSON("findAndModify" << _coll
                                  << "upsert" << true
                                  << "query"    << BSON("_id" << base + i)
                                  << "update" << BSON("_id" << base + i)));

                }
            }
    };

    /*
     * Performs a distinct command to get the total number of distinct values for the field "x"
     */
    class DistinctWithIndex {
        public:
            bool readOnly() { return true; }
            void reset(Connection *cc) {
                cc->clearDB();
                cc->ensureIndex(-1, BSON("x" << 1));
                for (int i = 0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSON("x" << 1));
                    cc->insert(-1, BSON("x" << 2));
                    cc->insert(-1, BSON("x" << 3));
                }
                cc->getLastError();
            }
            void run(int threadId, int totalThreads, Connection *cc) {
                for (int i = 0; i < 100; ++i) {
                    cc->command(threadId, BSON("distinct" << _coll << 
                                            "key" << "x" <<
                                            "query" << BSON("x" << 2)));
                }
            }
    };

    /*
     * Performs a distinct command to get the total number of distinct values for the field "x"
     */
    class DistinctWithoutIndex {
        public:
            bool readOnly() { return true; }
            void reset(Connection *cc) {
                cc->clearDB();
                for (int i = 0; i < cc->getIterations(); i++) {
                    cc->insert(-1, BSON("x" << 1));
                    cc->insert(-1, BSON("x" << 2));
                    cc->insert(-1, BSON("x" << 3));
                }
                cc->getLastError();
            }
            void run(int threadId, int totalThreads, Connection *cc) {
                for (int i = 0; i < 100; ++i) {
                    cc->command(threadId, BSON("distinct" << _coll 
                                            << "key" << "x" <<
                                           "query" << BSON("x" << 2)));
                }
            }
    };

} // namespace Commands

