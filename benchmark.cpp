#include <mongo/client/dbclient.h>
#include <iostream>
#include <cstdlib>
#include <vector>
#include <boost/date_time/posix_time/posix_time.hpp>
#include <boost/bind.hpp>
#include <boost/foreach.hpp>
#include <boost/thread.hpp>

#ifndef _WIN32
#include <cxxabi.h>
#endif

// use MONGO convenience macros
#define PRINT(x) MONGO_PRINT(x)
#define PRINTFL  MONGO_PRINTFL

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

    void update(int thread, const BSONObj& qObj, const BSONObj uObj, bool upsert=false, bool multi=false) {
        assert(thread != -1); // cant run on all conns
        _conn[thread].update(ns[multi_db?thread:0], qObj, uObj, upsert, multi);
        return;
    }

    void findOne(int thread, const BSONObj& obj) {
        assert(thread != -1); // cant run on all conns
        _conn[thread].findOne(ns[multi_db?thread:0], obj);
        return;
    }

    auto_ptr<DBClientCursor> query(int thread, const Query& q, int limit=0, int skip=0) {
        assert(thread != -1); // cant run on all conns
        return _conn[thread].query(ns[multi_db?thread:0], q, limit, skip);
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
} // namespace Commands

namespace{
    struct TheTestSuite : TestSuite{
        TheTestSuite(){
            //add< Overhead::DoNothing >();

            //add< Insert::Empty >();
            //add< Insert::EmptyBatched<2> >();
            //add< Insert::EmptyBatched<10> >();
            //add< Insert::EmptyBatched<100> >();
            //add< Insert::EmptyBatched<1000> >();
            //add< Insert::EmptyCapped >();
            //add< Insert::JustID >();
            //add< Insert::IntID >();
            //add< Insert::IntIDUpsert >();
            //add< Insert::JustNum >();
            //add< Insert::JustNumIndexedBefore >();
            //add< Insert::JustNumIndexedAfter >();
            //add< Insert::NumAndID >();
            
            //add< Update::IncNoIndexUpsert >();
            //add< Update::IncWithIndexUpsert >();
            //add< Update::IncNoIndex >();
            //add< Update::IncWithIndex >();
            //add< Update::IncNoIndex_QueryOnSecondary >();
            //add< Update::IncWithIndex_QueryOnSecondary >();

            //add< Queries::Empty >();
            //add< Queries::HundredTableScans >();
            add< Queries::IntID >();
            add< Queries::IntIDRange >();
            //add< Queries::IntIDFindOne >();
            //add< Queries::IntNonID >();
            //add< Queries::IntNonIDRange >();
            //add< Queries::IntNonIDFindOne >();
            //add< Queries::RegexPrefixFindOne >();
            //add< Queries::TwoIntsBothBad >();
            //add< Queries::TwoIntsBothGood >();
            //add< Queries::TwoIntsFirstGood >();
            //add< Queries::TwoIntsSecondGood >();

            //add< Commands::CountsFullCollection >();
            //add< Commands::CountsIntIDRange >();
            //add< Commands::FindAndModifyInserts >();

        }
    } theTestSuite;
}

int main(int argc, const char **argv){
    if (argc < 3 || argc > 6){
        cerr << argv[0] << " <port> <iterations> [<multidb (1 or 0)>] [<username>] [<password>]" << endl;
        return 1;
    }

    string username;
    string password;

    iterations = atoi(argv[2]);

    if (argc > 3)
        multi_db = (argv[3][0] == '1');

    if (argc > 4) {
        username = argv[4];
    }
    if (argc > 5) {
        password = argv[5];
    }

    if (!username.empty() && password.empty()) {
        cerr << "Cannot provide username without also providing password" << endl;
    }

    for (int i=0; i < max_threads; i++){
        string dbname = _db + BSONObjBuilder::numStr(i);
        ns[i] = dbname + '.' + _coll;
        string errmsg;
        if ( ! _conn[i].connect( string( "127.0.0.1:" ) + argv[1], errmsg ) ) {
            cerr << "couldn't connect : " << errmsg << endl;
            return 1;
        }

        // Handle authentication if necessary
        if (!username.empty()) {
            cerr << "authenticating as user: " << username << " with password: " << password << endl;
            if (!_conn[i].auth((multi_db ? dbname : "admin"), username, password, errmsg)) {
                cerr << "Auth failed : " << errmsg << endl;
                return 1;
            }
        }
    }

    theTestSuite.run();

    return 0;
}