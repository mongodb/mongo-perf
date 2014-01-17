#include <mongo/client/dbclient.h>
#include <iostream>
#include <cstdlib>
#include <vector>
#include <boost/date_time/posix_time/posix_time.hpp>
#include <boost/bind.hpp>
#include <boost/foreach.hpp>
#include <boost/lexical_cast.hpp>
#include <boost/program_options.hpp>
#include <boost/thread.hpp>

#ifndef _WIN32
#include <cxxabi.h>
#endif

// use MONGO convenience macros
#define PRINT(x) MONGO_PRINT(x)
#define PRINTFL  MONGO_PRINTFL

namespace po = boost::program_options;
using namespace std;
using namespace mongo;


namespace {
    const int thread_nums[] = {1,2,4,6,8,12,16};
    const int max_threads = 16;
    // Global connections
    DBClientConnection _conn[max_threads];

    bool multi_db = false;

    const char* _db = "benchmarks";
    const char* _coll = "collection";
    string ns[max_threads];


    string nsToDatabase(string ns) {
        size_t i = ns.find('.');
        if (i == string::npos) {
            return ns;
        }
        return ns.substr(0, i);
    }

    // wrapper funcs to route to different dbs. thread == -1 means all dbs
    void ensureIndex(int thread, const BSONObj& obj) {
        if (!multi_db){
            _conn[max(0,thread)].resetIndexCache();
            _conn[max(0,thread)].ensureIndex(ns[0], obj);
        }
        else if (thread != -1){
            _conn[thread].resetIndexCache();
            _conn[thread].ensureIndex(ns[thread], obj);
            return;
        }
        else {
            for (int t=0; t<max_threads; t++) {
                ensureIndex(t, obj);
            }
        }
    }

    template <typename VectorOrBSONObj>
    void insert(int thread, const VectorOrBSONObj& obj) {
        if (!multi_db){
            _conn[max(0,thread)].insert(ns[0], obj);
        }
        else if (thread != -1){
            _conn[thread].insert(ns[thread], obj);
            return;
        }
        else {
            for (int t=0; t<max_threads; t++) {
                insert(t, obj);
            }
        }
    }

    void remove(int thread, const BSONObj& qObj, bool onlyOne=false) {
        assert(thread != -1);
        _conn[thread].remove(ns[multi_db?thread:0], qObj, onlyOne);
    }

    void update(int thread, const BSONObj& qObj, const BSONObj uObj, bool upsert=false, bool multi=false) {
        assert(thread != -1); // cant run on all conns
        _conn[thread].update(ns[multi_db?thread:0], qObj, uObj, upsert, multi);
        return;
    }

    void findOne(int thread, const BSONObj& obj, const BSONObj& projection = BSONObj()) {
        assert(thread != -1); // cant run on all conns
        _conn[thread].findOne(ns[multi_db?thread:0], obj, &projection);
        return;
    }

    auto_ptr<DBClientCursor> query(int thread, const Query& q, int limit=0, int skip=0,
                                   const BSONObj& projection = BSONObj()) {
        assert(thread != -1); // cant run on all conns
        return _conn[thread].query(ns[multi_db?thread:0], q, limit, skip, &projection);
    }

    bool command(int thread, const BSONObj& obj) {
        assert(thread != -1); // can't run on all conns
        BSONObj info;
        return _conn[thread].runCommand(nsToDatabase(ns[multi_db?thread:0]), obj, info);
    }

    void getLastError(int thread=-1) {
        if (thread != -1){
            string err = _conn[thread].getLastError();
            if (err != "") {
                cerr << err << endl;
                exit(1);
            }
            return;
        }

        for (int t=0; t<max_threads; t++)
            getLastError(t);
    }
    

    // passed in as argument
    int iterations;

    struct TestBase{
        virtual void run(int thread, int nthreads) = 0;
        virtual void reset() = 0;
        virtual bool readOnly() = 0; // if true only reset before first run
        virtual string name() = 0;
        virtual ~TestBase() {}
    };

    template <typename T>
    struct Test: TestBase{
        virtual void run(int thread, int nthreads){
            test.run(thread, nthreads);
            getLastError(thread); //wait for operation to complete
        }
        virtual void reset(){
            test.reset();
            getLastError(); //wait for operation to complete
        }

        virtual bool readOnly(){
            return test.readOnly();
        }
        
        virtual string name(){
            //from mongo::regression::demangleName()
#ifdef _WIN32
            return typeid(T).name();
#else
            int status;

            char * niceName = abi::__cxa_demangle(typeid(T).name(), 0, 0, &status);
            if ( ! niceName )
                return typeid(T).name();

            string s = niceName;
            free(niceName);
            return s;
#endif
        }

        T test;
    };

    struct TestSuite{
            template <typename T>
            void add(){
                tests.push_back(new Test<T>());
            }
            void run(){
                for (vector<TestBase*>::iterator it=tests.begin(), end=tests.end(); it != end; ++it){
                    TestBase* test = *it;
                    boost::posix_time::ptime startTime, endTime; //reused

                    cerr << "########## " << test->name() << " ##########" << endl;

                    BSONObjBuilder results;

                    double one_micros;
                    bool resetDone = false;
                    BOOST_FOREACH(int nthreads, thread_nums){

                        if (!test->readOnly() || !resetDone) {
                            test->reset();
                            resetDone = true;
                        }
                        startTime = boost::posix_time::microsec_clock::universal_time();
                        launch_subthreads(nthreads, test);
                        endTime = boost::posix_time::microsec_clock::universal_time();
                        double micros = (endTime-startTime).total_microseconds() / 1000000.0;

                        if (nthreads == 1) 
                            one_micros = micros;

                        results.append(BSONObjBuilder::numStr(nthreads),
                                       BSON( "time" << micros
                                          << "ops_per_sec" << iterations / micros
                                          << "speedup" << one_micros / micros
                                          ));
                    }

                    BSONObj out =
                        BSON( "name" << test->name()
                           << "results" << results.obj()
                           );
                    cout << out.jsonString(Strict) << endl;
                }
            }
        private:
            vector<TestBase*> tests;

            void launch_subthreads(int remaining, TestBase* test, int total=-1){ //total = remaining
                if (!remaining) return;

                if (total == -1)
                    total = remaining;

                boost::thread athread(boost::bind(&TestBase::run, test, total-remaining, total));

                launch_subthreads(remaining - 1, test, total);

                athread.join();
            }
    };

    void clearDB(){
        for (int i=0; i<max_threads; i++) {
            string dbname = _db + BSONObjBuilder::numStr(i);
            BSONObj userObj = _conn[i].findOne(dbname + ".system.users", Query());
            _conn[i].dropDatabase(dbname);
            if (!userObj.isEmpty()) {
                _conn[i].insert(dbname + ".system.users", userObj);
            } else {
                // Insert an empty document just to make sure the data file is preallocated.
                _conn[i].insert(dbname + ".file_alloc", BSONObj());
            }
            _conn[i].getLastError();
            if (!multi_db)
                return;
        }
    }
}

namespace Overhead{
    // this tests the overhead of the system
    struct DoNothing{
        bool readOnly() { return false; }
        void run(int t, int n) {}
        void reset(){ clearDB(); }
    };
}

namespace Insert{
    struct Base{
        bool readOnly() { return false; }
        void reset(){ clearDB(); }
    };

    /*
     * inserts empty documents.
     */
    struct Empty : Base{
        void run(int t, int n) {
            for (int i=0; i < iterations / n; i++){
                insert(t, BSONObj());
            }
        }
    };

    /*
     * inserts batches of empty documents.
     */
    template <int BatchSize>
    struct EmptyBatched : Base{
        void run(int t, int n) {
            for (int i=0; i < iterations / BatchSize / n; i++){
                vector<BSONObj> objs(BatchSize);
                insert(t, objs);
            }
        }
    };

    /*
     * inserts empty documents into capped collections.
     */
    struct EmptyCapped : Base{
        void run(int t, int n) {
            for (int i=0; i < iterations / n; i++){
                insert(t, BSONObj());
            }
        }
        void reset(){
            clearDB();
            for (int t=0; t<max_threads; t++){
                _conn[t].createCollection(ns[t], 32 * 1024, true);
                if (!multi_db)
                    return;
            }
        }
    };

    /*
     * inserts documents just containing the field '_id' as an ObjectId.
     */
    struct JustID : Base{
        void run(int t, int n) {
            for (int i=0; i < iterations / n; i++){
                BSONObjBuilder b;
                b << GENOID;
                insert(t, b.obj());
            }
        }
    };

    /*
     * inserts documents just containing the field '_id' as an incrementing integer.
     */
    struct IntID : Base{
        void run(int t, int n) {
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                insert(t, BSON("_id" << base + i));
            }
        }
    };

    /*
     * upserts documents just containing the field '_id' as an incrementing integer.
     */
    struct IntIDUpsert : Base{
        void run(int t, int n) {
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                update(t, BSON("_id" << base + i), BSONObj(), true);
            }
        }
    };

    /*
     * inserts documents just containing the field 'x' as an incrementing integer.
     */
    struct JustNum : Base{
        void run(int t, int n) {
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                insert(t, BSON("x" << base + i));
            }
        }
    };

    /*
     * inserts documents just containing the field 'x' as an incrementing integer.
     * An index on 'x' is created before the run.
     */
    struct JustNumIndexedBefore : Base{
        void run(int t, int n) {
            ensureIndex(t, BSON("x" << 1));
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                insert(t, BSON("x" << base + i));
            }
        }
    };

    /*
     * inserts documents just containing the field 'x' as an incrementing integer.
     * An index on 'x' is created after the run.
     */
    struct JustNumIndexedAfter : Base{
        void run(int t, int n) {
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                insert(t, BSON("x" << base + i));
            }
            ensureIndex(t, BSON("x" << 1));
        }
    };

    /*
     * inserts documents containing the field '_id' as an ObjectId and the field 'x' as an incrementing integer.
     */
    struct NumAndID : Base{
        void run(int t, int n) {
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                BSONObjBuilder b;
                b << GENOID;
                b << "x" << base+i;
                insert(t, b.obj());
            }
        }
    };
}

namespace Update{
    struct Base{
        bool readOnly() { return false; }
        void reset(){ clearDB(); }
    };

    /*
     * Upserts 100 distinct documents based on an incrementing integer id.
     * For each document the '$inc' operator is called multiple times to increment the field 'count'.
     */
    struct IncNoIndexUpsert : Base{
        void run(int t, int n) {
            const int incs = iterations/n/100;
            for (int i=0; i<100; i++){
                for (int j=0; j<incs; j++){
                    update(t, BSON("_id" << i), BSON("$inc" << BSON("count" << 1)), 1);
                }
            }
        }
    };

    /*
     * Upserts 100 distincts documents based on an incrementing integer id.
     * For each document the '$inc' operator is called multiple times to increment the field 'count'.
     * An index on 'count' is created before the run.
     */
    struct IncWithIndexUpsert : Base{
        void reset(){ clearDB(); ensureIndex(-1, BSON("count" << 1));}
        void run(int t, int n) {
            const int incs = iterations/n/100;
            for (int i=0; i<100; i++){
                for (int j=0; j<incs; j++){
                    update(t, BSON("_id" << i), BSON("$inc" << BSON("count" << 1)), 1);
                }
            }
        }
    };

    /*
     * Inserts 100 documents with an incrementing integer id and a 'count' field.
     * For each document an update with the '$inc' operator is called multiple times to increment the field 'count'.
     */
    struct IncNoIndex : Base{
        void reset(){
            clearDB(); 
            for (int i=0; i<100; i++)
                insert(-1, BSON("_id" << i << "count" << 0));
        }
        void run(int t, int n) {
            const int incs = iterations/n/100;
            for (int i=0; i<100; i++){
                for (int j=0; j<incs; j++){
                    update(t, BSON("_id" << i), BSON("$inc" << BSON("count" << 1)));
                }
            }
        }
    };

    /*
     * Inserts 100 documents with an incrementing integer id and a 'count' field.
     * For each document an update with the '$inc' operator is called multiple times to increment the field 'count'.
     * An index on 'count' is created before the run.
     */
    struct IncWithIndex : Base{
        void reset(){
            clearDB(); 
            ensureIndex(-1, BSON("count" << 1));
            for (int i=0; i<100; i++)
                insert(-1, BSON("_id" << i << "count" << 0));
        }
        void run(int t, int n) {
            const int incs = iterations/n/100;
            for (int i=0; i<100; i++){
                for (int j=0; j<incs; j++){
                    update(t, BSON("_id" << i), BSON("$inc" << BSON("count" << 1)));
                }
            }
        }
    };

    /*
     * Inserts 100 documents with an incrementing integer id, a field 'i' equals to the id, and a 'count' field.
     * For each document an update with the '$inc' operator is called multiple times to increment the field 'count', using a query on 'i'.
     * An index on 'i' is created before the run.
     */
    struct IncNoIndex_QueryOnSecondary : Base{
        void reset(){
            clearDB(); 
            ensureIndex(-1, BSON("i" << 1));
            for (int i=0; i<100; i++)
                insert(-1, BSON("_id" << i << "i" << i << "count" << 0));
        }
        void run(int t, int n) {
            const int incs = iterations/n/100;
            for (int i=0; i<100; i++){
                for (int j=0; j<incs; j++){
                    update(t, BSON("i" << i), BSON("$inc" << BSON("count" << 1)));
                }
            }
        }
    };

    /*
     * Inserts 100 documents with an incrementing integer id, a field 'i' equals to the id, and a 'count' field.
     * For each document an update with the '$inc' operator is called multiple times to increment the field 'count', using a query on 'i'.
     * Indexes on 'i' and 'count' are created before the run.
     */
    struct IncWithIndex_QueryOnSecondary : Base{
        void reset(){
            clearDB(); 
            ensureIndex(-1, BSON("count" << 1));
            ensureIndex(-1, BSON("i" << 1));
            for (int i=0; i<100; i++)
                insert(-1, BSON("_id" << i << "i" << i << "count" << 0));
        }
        void run(int t, int n) {
            const int incs = iterations/n/100;
            for (int i=0; i<100; i++){
                for (int j=0; j<incs; j++){
                    update(t, BSON("i" << i), BSON("$inc" << BSON("count" << 1)));
                }
            }
        }
    };

    // Some tests based on the MMS workload. These started as Eliot's 'mms.js' tests, which acm
    // then extended and used for the first round of update performance improvements. We are
    // capturing them here so they are run automatically. These tests explore the overhead of
    // reaching into deep right children in complex documents.
    struct MMSBase : Base {

        void reset() {
            clearDB();


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
            insert(-1, docBuilder.done());
            getLastError();
        }

    };

    /*
     * Increment one shallow (top level) fields
     */
    struct MmsIncShallow1 : public MMSBase {
        void run(int t, int n) {
            const int ops = iterations/n;
            for (int op = 0; op != ops; ++op) {
                update(t, BSON("_id" << 0),
                       BSON("$inc" <<
                            BSON("a" << 1)));
            }
        }
    };

    /*
     * Increment two shallow (top level) fields.
     */
    struct MmsIncShallow2 : public MMSBase {
        void run(int t, int n) {
            const int ops = iterations/n;
            for (int op = 0; op != ops; ++op) {
                update(t, BSON("_id" << 0),
                       BSON("$inc" <<
                            BSON("a" << 1 <<
                                 "z" << 1)));
            }
        }
    };

    /*
     * Increment one deep field. The selected field is far to the right in each subtree.
     */
    struct MmsIncDeep1 : public MMSBase {
        void run(int t, int n) {
            const int ops = iterations/n;
            for (int op = 0; op != ops; ++op) {
                update(t, BSON("_id" << 0),
                       BSON("$inc" <<
                            BSON("h.23.59.n" << 1)));
            }
        }
    };

    /*
     * Increment two deep fields. The selected fields are far to the right in each subtree, and
     * share a common prefix.
     */
    struct MmsIncDeepSharedPath2 : public MMSBase {
        void run(int t, int n) {
            const int ops = iterations/n;
            for (int op = 0; op != ops; ++op) {
                update(t, BSON("_id" << 0),
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
    struct MmsIncDeepSharedPath3 : public MMSBase {
        void run(int t, int n) {
            const int ops = iterations/n;
            for (int op = 0; op != ops; ++op) {
                update(t, BSON("_id" << 0),
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
    struct MmsIncDeepDistinctPath2 : public MMSBase {
        void run(int t, int n) {
            const int ops = iterations/n;
            for (int op = 0; op != ops; ++op) {
                update(t, BSON("_id" << 0),
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
    struct MmsIncDeepDistinctPath3 : public MMSBase {
        void run(int t, int n) {
            const int ops = iterations/n;
            for (int op = 0; op != ops; ++op) {
                update(t, BSON("_id" << 0),
                       BSON("$inc" <<
                            BSON("h.21.59.n" << 1 <<
                                 "h.22.59.t" << 1 <<
                                 "h.23.59.v" << 1)));
            }
        }
    };


}

namespace Remove {
    struct Base {
        bool readOnly() { return false; };
    };

    struct IntID: public Base {
        void reset() {
            clearDB();
            for (int i = 0; i < iterations; ++i) {
                insert(-1, BSON("_id" << i));
            }
            getLastError();
        }
 
        void run(int t, int n) {
            int base = t * (iterations / n);
            for (int i = 0; i < iterations / n; ++i) {
                remove(t, BSON("_id" << base + i));
            }
        }
    };

    struct IntIDRange : public Base {
        void reset() {
            clearDB();
            for (int i = 0; i < iterations; ++i) {
                insert(-1, BSON("_id" << i));
            }
            getLastError();
        }

        void run(int t, int n) {
            int chunk = iterations / n;
            remove(t, BSON("_id" << GTE << chunk * t << LT << chunk * (t + 1)));
        }
    };

    struct IntNonID: public Base {
        void reset() {
            clearDB();
            ensureIndex(-1, BSON("x" << 1));
            for (int i = 0; i < iterations; ++i) {
                insert(-1, BSON("x" << i));
            }
            getLastError();
        }

        void run(int t, int n) {
            int base = t * (iterations / n);
            for (int i = 0; i < iterations / n; ++i) {
                remove(t, BSON("x" << base + i));
            }
        }
    };

    struct IntNonIDRange: public Base {
        void reset() {
            clearDB();
            ensureIndex(-1, BSON("x" << 1));
            for (int i = 0; i < iterations; ++i) {
                insert(-1, BSON("x" << i));
            }
            getLastError();
        }

        void run(int t, int n) {
            int chunk = iterations / n;
            remove(t, BSON("x" << GTE << chunk * t << LT << chunk * (t + 1)));
        }
    };
}

namespace Queries{
    struct Base{
        bool readOnly() { return true; }
    };

    /*
     * Does one query using an empty pattern, then iterates over results.
     * The documents are inserted as empty objects.
     */
    struct Empty : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                insert(-1, BSONObj());
            }
            getLastError();
        }

        void run(int t, int n){
            int chunk = iterations / n;
            auto_ptr<DBClientCursor> cursor = query(t, BSONObj(), chunk, chunk*t);
            cursor->itcount();
        }
    };

    /*
     * Does a total of 100 queries (across threads) using a match on a nonexistent field, triggering table scans.
     * The documents are inserted as empty objects.
     */
    struct HundredTableScans : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                insert(-1, BSONObj());
            }
            getLastError();
        }

        void run(int t, int n){
            for (int i=0; i < 100/n; i++){
                findOne(t, BSON("does_not_exist" << i));
            }
        }
    };

    /*
     * Does one query using an empty pattern, then iterates over results.
     * The documents are inserted with an incrementing integer id.
     */
    struct IntID : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("_id" << i));
            }
            getLastError();
        }

        void run(int t, int n){
            int chunk = iterations / n;
            auto_ptr<DBClientCursor> cursor = query(t, BSONObj(), chunk, chunk*t);
            cursor->itcount();
        }
    };

    /*
     * Does one query using a range on the id, then iterates over results.
     * The documents are inserted with an incrementing integer id.
     */
    struct IntIDRange : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("_id" << i));
            }
            getLastError();
        }

        void run(int t, int n){
            int chunk = iterations / n;
            auto_ptr<DBClientCursor> cursor = query(t, BSON("_id" << GTE << chunk*t << LT << chunk*(t+1)));
            cursor->itcount();
        }
    };

    /*
     * Issues findOne queries with a match on id.
     * The documents are inserted with an incrementing integer id.
     */
    struct IntIDFindOne : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("_id" << i));
            }
            getLastError();
        }

        void run(int t, int n){
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                findOne(t, BSON("_id" << base + i));
            }
        }
    };

    /*
     * Does one query using an empty pattern, then iterates over results.
     * The documents are inserted with an incrementing integer field 'x' that is indexed.
     */
    struct IntNonID : Base{
        void reset() {
            clearDB();
            ensureIndex(-1, BSON("x" << 1));
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << i));
            }
            getLastError();
        }

        void run(int t, int n){
            int chunk = iterations / n;
            auto_ptr<DBClientCursor> cursor = query(t, BSONObj(), chunk, chunk*t);
            cursor->itcount();
        }
    };

    /*
     * Does one query using a range on field 'x', then iterates over results.
     * The documents are inserted with an incrementing integer field 'x' that is indexed.
     */
    struct IntNonIDRange : Base{
        void reset() {
            clearDB();
            ensureIndex(-1, BSON("x" << 1));
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << i));
            }
            getLastError();
        }

        void run(int t, int n){
            int chunk = iterations / n;
            auto_ptr<DBClientCursor> cursor = query(t, BSON("x" << GTE << chunk*t << LT << chunk*(t+1)));
            cursor->itcount();
        }
    };

    /*
     * Issues findOne queries with a match on 'x' field.
     * The documents are inserted with an incrementing integer field 'x' that is indexed.
     */
    struct IntNonIDFindOne : Base{
        void reset() {
            clearDB();
            ensureIndex(-1, BSON("x" << 1));
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << i));
            }
            getLastError();
        }

        void run(int t, int n){
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                findOne(t, BSON("x" << base + i));
            }
        }
    };

    /*
     * Issues findOne queries with a left-rooted regular expression on the 'x' field.
     * The documents are inserted with an incrementing integer field 'x' that is converted to a string and indexed.
     */
    struct RegexPrefixFindOne : Base{
        RegexPrefixFindOne(){
            for (int i=0; i<100; i++)
                nums[i] = "^" + BSONObjBuilder::numStr(i+1);
        }
        void reset() {
            clearDB();
            ensureIndex(-1, BSON("x" << 1));
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << BSONObjBuilder::numStr(i)));
            }
            getLastError();
        }

        void run(int t, int n){
            for (int i=0; i < iterations / n / 100; i++){
                for (int j=0; j<100; j++){
                    BSONObjBuilder b;
                    b.appendRegex("x", nums[j]);
                    findOne(t, b.obj());
                }
            }
        }
        string nums[100];
    };

    /*
     * Issues findOne queries with a match on 'x' and 'y' field.
     * The documents are inserted with an incrementing integer field 'x' and decrementing field 'y' that are indexed.
     */
    struct TwoIntsBothGood : Base{
        void reset() {
            clearDB();
            ensureIndex(-1, BSON("x" << 1));
            ensureIndex(-1, BSON("y" << 1));
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << i << "y" << (iterations-i)));
            }
            getLastError();
        }

        void run(int t, int n){
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                findOne(t, BSON("x" << base + i << "y" << (iterations-(base+i))));
            }
        }
    };

    /*
     * Issues findOne queries with a match on 'x' and 'y' field.
     * The documents are inserted with an incrementing integer field 'x' and a field 'y' using modulo (low cardinality), that are indexed.
     */
    struct TwoIntsFirstGood : Base{
        void reset() {
            clearDB();
            ensureIndex(-1, BSON("x" << 1));
            ensureIndex(-1, BSON("y" << 1));
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << i << "y" << (i%13)));
            }
            getLastError();
        }

        void run(int t, int n){
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                findOne(t, BSON("x" << base + i << "y" << ((base+i)%13)));
            }
        }
    };

    /*
     * Issues findOne queries with a match on 'x' and 'y' field.
     * The documents are inserted with a field 'x' using modulo (low cardinality) and an incrementing integer field 'y', that are indexed.
     */
    struct TwoIntsSecondGood : Base{
        void reset() {
            clearDB();
            ensureIndex(-1, BSON("x" << 1));
            ensureIndex(-1, BSON("y" << 1));
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << (i%13) << "y" << i));
            }
            getLastError();
        }

        void run(int t, int n){
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                findOne(t, BSON("x" << ((base+i)%13) << "y" << base+i));
            }
        }
    };

    /*
     * Issues findOne queries with a match on 'x' and 'y' field.
     * The documents are inserted with fields 'x' and 'y' both using modulos (low cardinality)
     */
    struct TwoIntsBothBad : Base{
        void reset() {
            clearDB();
            ensureIndex(-1, BSON("x" << 1));
            ensureIndex(-1, BSON("y" << 1));
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << (i%503) << "y" << (i%509))); // both are prime
            }
            getLastError();
        }

        void run(int t, int n){
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                findOne(t, BSON("x" << ((base+i)%503) << "y" << ((base+i)%509)));
            }
        }
    };

    /*
     * Issues queries with a projection on the 'x' field and iterates the results
     * The documents are inserted with only the field 'x', so this should not project out anything
     */
    struct ProjectionNoop : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << i));
            }
            getLastError();
        }

        void run(int threadId, int totalThreads){
            int batchSize = iterations / totalThreads;
            auto_ptr<DBClientCursor> cursor = query(threadId,
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
    struct ProjectionNoopFindOne : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << i));
            }
            getLastError();
        }

        void run(int threadId, int totalThreads){
            int batchSize = iterations / totalThreads;
            for (int i = threadId * batchSize; i < (threadId + 1) * batchSize; i++){
                findOne(threadId, BSON("x" << i), BSON("x" << 1));
            }
        }
    };

    /*
     * Issues queries with a projection on the 'x' field and iterates the results
     * The documents are inserted with the fields 'x' and 'y', so this should project out 'y'
     */
    struct ProjectionSingle : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << i << "y" << 1));
            }
            getLastError();
        }

        void run(int threadId, int totalThreads){
            int batchSize = iterations / totalThreads;
            auto_ptr<DBClientCursor> cursor = query(threadId,
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
    struct ProjectionSingleFindOne : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << i << "y" << 1));
            }
            getLastError();
        }

        void run(int threadId, int totalThreads){
            int batchSize = iterations / totalThreads;
            for (int i = threadId * batchSize; i < (threadId + 1) * batchSize; i++){
                findOne(threadId, BSON("x" << i), BSON("x" << 1));
            }
        }
    };

    /*
     * Issues queries with a projection to remove the '_id' field and iterates the results
     * The documents are inserted with the field 'x, so this should project out '_id' and leave 'x'
     */
    struct ProjectionUnderscoreId : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << i));
            }
            getLastError();
        }

        void run(int threadId, int totalThreads){
            int batchSize = iterations / totalThreads;
            auto_ptr<DBClientCursor> cursor = query(threadId,
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
    struct ProjectionUnderscoreIdFindOne : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << i));
            }
            getLastError();
        }

        void run(int threadId, int totalThreads){
            int batchSize = iterations / totalThreads;
            for (int i = threadId * batchSize; i < (threadId + 1) * batchSize; i++){
                findOne(threadId, BSON("x" << i), BSON("_id" << 0));
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
    struct ProjectionWideDocNarrowProjection : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                // NOTE: This will be slow, but this part of the test is not timed, so that's ok
                BSONObjBuilder b;
                b.append("key", i);
                for (int j=0; j < countof(fieldNames); j++){
                    b.append(fieldNames[j], 1);
                }
                insert(-1, b.obj());
            }
            getLastError();
        }

        void run(int threadId, int totalThreads){
            int batchSize = iterations / totalThreads;
            auto_ptr<DBClientCursor> cursor = query(threadId,
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
    struct ProjectionWideDocNarrowProjectionFindOne : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                // NOTE: This will be slow, but this part of the test is not timed, so that's ok
                BSONObjBuilder b;
                b.append("key", i);
                for (int j=0; j < countof(fieldNames); j++){
                    b.append(fieldNames[j], 1);
                }
                insert(-1, b.obj());
            }
            getLastError();
        }

        void run(int threadId, int totalThreads){
            int batchSize = iterations / totalThreads;
            for (int i = threadId * batchSize; i < (threadId + 1) * batchSize; i++){
                findOne(threadId, BSON("key" << i), BSON("key" << 1));
            }
        }
    };

    /*
     * Issues queries with a projection excluding the 'key' field and iterates the results
     * The documents are inserted with many fields, so this should include all of them but "key"
     */
    struct ProjectionWideDocWideProjection : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                // NOTE: This will be slow, but this part of the test is not timed, so that's ok
                BSONObjBuilder b;
                b.append("key", i);
                for (int j=0; j < countof(fieldNames); j++){
                    b.append(fieldNames[j], 1);
                }
                insert(-1, b.obj());
            }
            getLastError();
        }

        void run(int threadId, int totalThreads){
            int batchSize = iterations / totalThreads;
            auto_ptr<DBClientCursor> cursor = query(threadId,
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
    struct ProjectionWideDocWideProjectionFindOne : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                // NOTE: This will be slow, but this part of the test is not timed, so that's ok
                BSONObjBuilder b;
                b.append("key", i);
                for (int j=0; j < countof(fieldNames); j++){
                    b.append(fieldNames[j], 1);
                }
                insert(-1, b.obj());
            }
            getLastError();
        }

        void run(int threadId, int totalThreads){
            int batchSize = iterations / totalThreads;
            for (int i = threadId * batchSize; i < (threadId + 1) * batchSize; i++){
                findOne(threadId, BSON("key" << i), BSON("key" << 0));
            }
        }
    };

namespace {
    // Helper class for building and projecting deeply nested document
    struct NestedProjectionTests : Base{

        std::string projectionKey;

        // Depth of nested document to insert
        virtual int nestedDepth() = 0;

        // Depth of document to exclude
        virtual int projectionDepth() = 0;

        void reset() {
            clearDB();
            projectionKey = buildNestedProjectionKey(projectionDepth());
            for (int i=0; i < iterations; i++){
                // NOTE: This will be slow, but this part of the test is not timed, so that's ok
                BSONObjBuilder b;
                b.append("key", i);
                addNestedDocument(nestedDepth(), &b);
                insert(-1, b.obj());
            }
            getLastError();
        }

        virtual void run(int threadId, int totalThreads) = 0;

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

        // Returns a string referencing an element at "depth".  Should use the same or lesser "depth" as
        // what was passed into the function above.
        std::string buildNestedProjectionKey(int depth) {
            if (depth == 1) {
                return "a";
            }
            else {
                return std::string("a.").append(buildNestedProjectionKey(depth - 1));
            }
        }
    };

    struct NestedProjectionFindOne : NestedProjectionTests{
        void run(int threadId, int totalThreads){
            int batchSize = iterations / totalThreads;
            for (int i = threadId * batchSize; i < (threadId + 1) * batchSize; i++){
                findOne(threadId, BSON("key" << i), BSON(projectionKey << 0));
            }
        }
    };

    struct NestedProjectionCursor : NestedProjectionTests{
        void run(int threadId, int totalThreads){
            int batchSize = iterations / totalThreads;
            auto_ptr<DBClientCursor> cursor = query(threadId,
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
     * Tests for different levels of projection on different levels of nested documents
     */
    struct Projection100Nested100Projection : NestedProjectionCursor{
        int nestedDepth() { return 100; }
        int projectionDepth() { return 100; }
    };
    struct Projection100Nested100ProjectionFindOne : NestedProjectionFindOne{
        int nestedDepth() { return 100; }
        int projectionDepth() { return 100; }
    };
    struct Projection50Nested50Projection : NestedProjectionCursor{
        int nestedDepth() { return 50; }
        int projectionDepth() { return 50; }
    };
    struct Projection50Nested50ProjectionFindOne : NestedProjectionFindOne{
        int nestedDepth() { return 50; }
        int projectionDepth() { return 50; }
    };
    struct Projection10Nested10Projection : NestedProjectionCursor{
        int nestedDepth() { return 10; }
        int projectionDepth() { return 10; }
    };
    struct Projection10Nested10ProjectionFindOne : NestedProjectionFindOne{
        int nestedDepth() { return 10; }
        int projectionDepth() { return 10; }
    };
    struct Projection100Nested50Projection : NestedProjectionCursor{
        int nestedDepth() { return 100; }
        int projectionDepth() { return 50; }
    };
    struct Projection100Nested50ProjectionFindOne : NestedProjectionFindOne{
        int nestedDepth() { return 100; }
        int projectionDepth() { return 50; }
    };
    struct Projection100Nested10Projection : NestedProjectionCursor{
        int nestedDepth() { return 100; }
        int projectionDepth() { return 10; }
    };
    struct Projection100Nested10ProjectionFindOne : NestedProjectionFindOne{
        int nestedDepth() { return 100; }
        int projectionDepth() { return 10; }
    };
    struct Projection50Nested10Projection : NestedProjectionCursor{
        int nestedDepth() { return 50; }
        int projectionDepth() { return 10; }
    };
    struct Projection50Nested10ProjectionFindOne : NestedProjectionFindOne{
        int nestedDepth() { return 50; }
        int projectionDepth() { return 10; }
    };

    /*
     * Issues queries with an $elemMatch projection on the { 'x' : 2 } document and iterates the
     * results
     */
    struct ProjectionElemMatch : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << BSON_ARRAY(BSON("x" << 1) <<
                                                  BSON("x" << 2) <<
                                                  BSON("x" << 3))));
            }
            getLastError();
        }

        void run(int threadId, int totalThreads){
            int batchSize = iterations / totalThreads;
            auto_ptr<DBClientCursor> cursor = query(threadId,
                                                    BSON("x" << GTE << batchSize * threadId
                                                             << LT << batchSize * (threadId + 1)),
                                                    0, /* limit */
                                                    0, /* skip */
                                                    BSON("x" <<
                                                         BSON("$elemMatch" <<
                                                              BSON("x" << 2))) /* projection */);
            cursor->itcount();
        }
    };

    /*
     * Issues findOne queries with an $elemMatch projection on the { 'x' : 2 } document
     */
    struct ProjectionElemMatchFindOne : Base{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("x" << BSON_ARRAY(BSON("x" << 1) <<
                                                  BSON("x" << 2) <<
                                                  BSON("x" << 3))));
            }
            getLastError();
        }

        void run(int threadId, int totalThreads){
            int batchSize = iterations / totalThreads;
            for (int i = threadId * batchSize; i < (threadId + 1) * batchSize; i++){
                findOne(threadId, BSON("x" << i),
                        BSON("x" << BSON("$elemMatch" << BSON("x" << 2))));
            }
        }
    };

}

namespace Commands {

    /*
     * Performs a count command to get the total number of documents in the collection
     */
    struct CountsFullCollection {
        bool readOnly() { return true; }
        void reset() {
            clearDB();
            for (int i = 0; i < iterations; i++) {
                insert(-1, BSONObj());
            }
            getLastError();
        }
        void run(int t, int n) {
            for (int i = 0; i < iterations / n; i++) {
                command(t, BSON("count" << _coll));
            }
        }
    };

    /*
     * Performs a count using a range on the id.
     * The documents are inserted with an incrementing integer id.
     */
    struct CountsIntIDRange {
        bool readOnly() { return true; }
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                insert(-1, BSON("_id" << i));
            }
            getLastError();
        }
        void run(int t, int n) {
            int chunk = iterations / n;
            command(t, BSON("count" << _coll <<
                            "query" << BSON("_id" << GTE << chunk * t << LT << chunk * (t+1))));
        }
    };

    /*
     * Uses findAndModify to insert documents containing _id as an incrementing integer
     */
    struct FindAndModifyInserts {
        bool readOnly() { return false; }
        void reset() { clearDB(); }
        void run(int t, int n) {
            int base = t * (iterations/n);
            for (int i = 0; i < iterations / n; i++) {
                command(t, BSON("findAndModify" << _coll
                              << "upsert" << true
                              << "query" << BSON("_id" << base + i)
                              << "update" << BSON("_id" << base + i)));

            }
        }
    };

    /*
     * Performs a distinct command to get the total number of distinct values for the field "x"
     */
    struct DistinctWithIndex {
        bool readOnly() { return true; }
        void reset() {
            clearDB();
            ensureIndex(-1, BSON("x" << 1));
            for (int i = 0; i < iterations; i++) {
                insert(-1, BSON("x" << 1));
                insert(-1, BSON("x" << 2));
                insert(-1, BSON("x" << 3));
            }
            getLastError();
        }
        void run(int threadId, int totalThreads){
            for (int i = 0; i < iterations / totalThreads; i++) {
                command(threadId, BSON("distinct" << _coll << "key" << "x" <<
                                       "query" << BSON("x" << 2)));
            }
        }
    };

    /*
     * Performs a distinct command to get the total number of distinct values for the field "x"
     */
    struct DistinctWithoutIndex {
        bool readOnly() { return true; }
        void reset() {
            clearDB();
            for (int i = 0; i < iterations; i++) {
                insert(-1, BSON("x" << 1));
                insert(-1, BSON("x" << 2));
                insert(-1, BSON("x" << 3));
            }
            getLastError();
        }
        void run(int threadId, int totalThreads){
            for (int i = 0; i < iterations / totalThreads; i++) {
                command(threadId, BSON("distinct" << _coll << "key" << "x" <<
                                       "query" << BSON("x" << 2)));
            }
        }
    };

} // namespace Commands

namespace{
    struct TheTestSuite : TestSuite{
        TheTestSuite(){
            add< Overhead::DoNothing >();

            add< Insert::Empty >();
            add< Insert::EmptyBatched<2> >();
            add< Insert::EmptyBatched<10> >();
            add< Insert::EmptyBatched<100> >();
            add< Insert::EmptyBatched<1000> >();
            add< Insert::EmptyCapped >();
            add< Insert::JustID >();
            add< Insert::IntID >();
            add< Insert::IntIDUpsert >();
            add< Insert::JustNum >();
            add< Insert::JustNumIndexedBefore >();
            add< Insert::JustNumIndexedAfter >();
            add< Insert::NumAndID >();
            
            add< Update::IncNoIndexUpsert >();
            add< Update::IncWithIndexUpsert >();
            add< Update::IncNoIndex >();
            add< Update::IncWithIndex >();
            add< Update::IncNoIndex_QueryOnSecondary >();
            add< Update::IncWithIndex_QueryOnSecondary >();
            add< Update::MmsIncShallow1 >();
            add< Update::MmsIncShallow2 >();
            add< Update::MmsIncDeep1 >();
            add< Update::MmsIncDeepSharedPath2 >();
            add< Update::MmsIncDeepSharedPath3 >();
            add< Update::MmsIncDeepDistinctPath2 >();
            add< Update::MmsIncDeepDistinctPath3 >();

            add< Remove::IntID >();
            add< Remove::IntIDRange >();
            add< Remove::IntNonID >();
            add< Remove::IntNonIDRange >();

            add< Queries::Empty >();
            add< Queries::HundredTableScans >();
            add< Queries::IntID >();
            add< Queries::IntIDRange >();
            add< Queries::IntIDFindOne >();
            add< Queries::IntNonID >();
            add< Queries::IntNonIDRange >();
            add< Queries::IntNonIDFindOne >();
            add< Queries::RegexPrefixFindOne >();
            add< Queries::TwoIntsBothBad >();
            add< Queries::TwoIntsBothGood >();
            add< Queries::TwoIntsFirstGood >();
            add< Queries::TwoIntsSecondGood >();
            add< Queries::ProjectionNoop >();
            add< Queries::ProjectionNoopFindOne >();
            add< Queries::ProjectionSingle >();
            add< Queries::ProjectionSingleFindOne >();
            add< Queries::ProjectionUnderscoreId >();
            add< Queries::ProjectionUnderscoreIdFindOne >();
            add< Queries::ProjectionWideDocNarrowProjection >();
            add< Queries::ProjectionWideDocNarrowProjectionFindOne >();
            add< Queries::ProjectionWideDocWideProjection >();
            add< Queries::ProjectionWideDocWideProjectionFindOne >();
            add< Queries::Projection100Nested100Projection >();
            add< Queries::Projection100Nested100ProjectionFindOne >();
            add< Queries::Projection50Nested50Projection >();
            add< Queries::Projection50Nested50ProjectionFindOne >();
            add< Queries::Projection10Nested10Projection >();
            add< Queries::Projection10Nested10ProjectionFindOne >();
            add< Queries::Projection100Nested50Projection >();
            add< Queries::Projection100Nested50ProjectionFindOne >();
            add< Queries::Projection100Nested10Projection >();
            add< Queries::Projection100Nested10ProjectionFindOne >();
            add< Queries::Projection50Nested10Projection >();
            add< Queries::Projection50Nested10ProjectionFindOne >();
            add< Queries::ProjectionElemMatch >();
            add< Queries::ProjectionElemMatchFindOne >();

            add< Commands::CountsFullCollection >();
            add< Commands::CountsIntIDRange >();
            add< Commands::FindAndModifyInserts >();
            add< Commands::DistinctWithIndex >();
            add< Commands::DistinctWithoutIndex >();

        }
    } theTestSuite;
}

int main(int argc, const char **argv){
    try {
        po::variables_map options_vars;
        string conn_string;
        string password;
        string username;
 
        po::options_description display_options("Program options");
        display_options.add_options()
            ("help", "Display help information");
        po::options_description all_options("All options");
        all_options.add_options()
            ("connection-string",   po::value<string>()->required(),    "Connection string")
            ("iterations",          po::value<int>()->required(),       "Number of iterations")
            ("multi-db",            po::bool_switch(),                  "MultiDB mode")
            ("username",            po::value<string>(),                "Username (auth)")
            ("password",            po::value<string>(),                "Password (auth)");

        all_options.add(display_options);
        
        po::store(po::command_line_parser(argc, argv)
                .options(all_options)
                .run(), options_vars);
        po::notify(options_vars);

        if (options_vars.count("help")) {
            cout << all_options << endl;
            return EXIT_SUCCESS;
        }

        if (options_vars.count("username") != options_vars.count("password")) {
            cout << "Authentication required both --username and --password" << endl;
            cout << endl;
            cout << display_options << endl;
            return EXIT_FAILURE;
        }

        // Mandatory options.
        conn_string = options_vars["connection-string"].as<string>();
        iterations = options_vars["iterations"].as<int>();

        // Optional options.
        if (options_vars.count("multi-db")) {
            multi_db = options_vars["multi-db"].as<bool>();
        }
 
        if (options_vars.count("username")) {
            username = options_vars["username"].as<string>();
        }

        if (options_vars.count("password")) {
            password = options_vars["password"].as<string>();
        }

        // XXX: should be moved somewhere else.
     
        for (int i=0; i < max_threads; i++){
            string dbname = _db + BSONObjBuilder::numStr(i);
            ns[i] = dbname + '.' + _coll;
            string errmsg;
            if (!_conn[i].connect(conn_string, errmsg)) {
                cerr << "couldn't connect : " << errmsg << endl;
                return EXIT_FAILURE;
            }

            // Handle authentication if necessary
            if (!username.empty()) {
                cerr << "authenticating as user: " << username << " with password: " << password << endl;
                if (!_conn[i].auth((multi_db ? dbname : "admin"), username, password, errmsg)) {
                    cerr << "Auth failed : " << errmsg << endl;
                    return EXIT_FAILURE;
                }
            }
        }
        theTestSuite.run();
        return EXIT_SUCCESS;
    }
    catch (po::error const & e) {
        cerr << "Unexpected " << e.what() << endl;
        cerr << "try " << argv[0] << "--help" << endl;
        return EXIT_FAILURE;
    }
    catch (std::exception const & e) {
        cerr << "Error: " << e.what() << endl;
        return EXIT_FAILURE;
    }
}

