#include <mongo/client/dbclient.h>
#include <iostream>
#include <cstdlib>
#include <vector>
#include <boost/date_time/posix_time/posix_time.hpp>
#include <boost/bind.hpp>

#ifndef _WIN32
#include <cxxabi.h>
#endif

using namespace std;
using namespace mongo;

namespace {
    const int max_threads = 10;
    // Global connections
    DBClientConnection conn[max_threads];

    const char* db = "benchmarks";
    const char* ns = "benchmarks.collection";
    const char* coll = "collection";

    // passed in as argument
    int iterations;

    struct TestBase{
        virtual void run(int thread, int nthreads) = 0;
        virtual void reset() = 0;
        virtual string name() = 0;
        virtual ~TestBase() {}
    };

    template <typename T>
    struct Test: TestBase{
        virtual void run(int thread, int nthreads){
            test.run(thread, nthreads);
            conn[thread].getLastError(); //wait for operation to complete
        }
        virtual void reset(){
            test.reset();
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
                    boost::posix_time::ptime start, end; //reused

                    cerr << "########## " << test->name() << " ##########" << endl;

                    test->reset();
                    start = boost::posix_time::microsec_clock::universal_time();
                    test->run(0, 1);
                    end = boost::posix_time::microsec_clock::universal_time();
                    double one_micros = (end-start).total_microseconds() / 1000000.0;

                    test->reset();
                    start = boost::posix_time::microsec_clock::universal_time();
                    launch_subthreads(2, test);
                    end = boost::posix_time::microsec_clock::universal_time();
                    double two_micros = (end-start).total_microseconds() / 1000000.0;

                    test->reset();
                    start = boost::posix_time::microsec_clock::universal_time();
                    launch_subthreads(4, test);
                    end = boost::posix_time::microsec_clock::universal_time();
                    double four_micros = (end-start).total_microseconds() / 1000000.0;

                    test->reset();
                    start = boost::posix_time::microsec_clock::universal_time();
                    launch_subthreads(max_threads, test);
                    end = boost::posix_time::microsec_clock::universal_time();
                    double ten_micros = (end-start).total_microseconds() / 1000000.0;

                    BSONObj out =
                        BSON( "name" << test->name()
                           << "results" <<
                               BSON( "one" <<
                                        BSON( "time" << one_micros
                                           << "ops_per_sec" << iterations / one_micros
                                           << "speedup" << one_micros / one_micros)
                                  << "two" <<
                                        BSON( "time" << two_micros
                                           << "ops_per_sec" << iterations / two_micros
                                           << "speedup" << one_micros / two_micros)
                                  << "four" <<
                                        BSON( "time" << four_micros
                                           << "ops_per_sec" << iterations / four_micros
                                           << "speedup" << one_micros / four_micros)
                                  << "ten" <<
                                        BSON( "time" << ten_micros
                                           << "ops_per_sec" << iterations / ten_micros
                                           << "speedup" << one_micros / ten_micros)
                                  )
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
        conn[0].dropDatabase(db);
        conn[0].getLastError();
    }
}

namespace Overhead{
    // this tests the overhead of the system
    struct DoNothing{
        void run(int t, int n) {}
        void reset(){ clearDB(); }
    };
}

namespace Insert{
    struct Base{
        void reset(){ clearDB(); }
    };

    struct Empty : Base{
        void run(int t, int n) {
            for (int i=0; i < iterations / n; i++){
                conn[t].insert(ns, BSONObj());
            }
        }
    };

    struct EmptyCapped : Base{
        void run(int t, int n) {
            for (int i=0; i < iterations / n; i++){
                conn[t].insert(ns, BSONObj());
            }
        }
        void reset(){
            clearDB();
            conn[0].createCollection(ns, 32 * 1024, true);
        }
    };

    struct JustID : Base{
        void run(int t, int n) {
            for (int i=0; i < iterations / n; i++){
                BSONObjBuilder b;
                b << GENOID;
                conn[t].insert(ns, b.obj());
            }
        }
    };

    struct IntID : Base{
        void run(int t, int n) {
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                conn[t].insert(ns, BSON("_id" << base + i));
            }
        }
    };

    struct IntIDUpsert : Base{
        void run(int t, int n) {
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                conn[t].update(ns, BSON("_id" << base + i), BSONObj(), true);
            }
        }
    };

    struct JustNum : Base{
        void run(int t, int n) {
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                conn[t].insert(ns, BSON("x" << base + i));
            }
        }
    };

    struct JustNumIndexedBefore : Base{
        void run(int t, int n) {
            conn[t].ensureIndex(ns, BSON("x" << 1));
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                conn[t].insert(ns, BSON("x" << base + i));
            }
        }
    };

    struct JustNumIndexedAfter : Base{
        void run(int t, int n) {
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                conn[t].insert(ns, BSON("x" << base + i));
            }
            conn[t].ensureIndex(ns, BSON("x" << 1));
        }
    };

    struct NumAndID : Base{
        void run(int t, int n) {
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                BSONObjBuilder b;
                b << GENOID;
                b << "x" << base+i;
                conn[t].insert(ns, b.obj());
            }
        }
    };
}

namespace Queries{
    struct Empty{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                conn[0].insert(ns, BSONObj());
            }
            conn[0].getLastError();
        }

        void run(int t, int n){
            int chunk = iterations / n;
            auto_ptr<DBClientCursor> cursor = conn[t].query(ns, BSONObj(), chunk, chunk*t);
            cursor->itcount();
        }
    };

    struct HundredTableScans{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                conn[0].insert(ns, BSONObj());
            }
            conn[0].getLastError();
        }

        void run(int t, int n){
            for (int i=0; i < 100/n; i++){
                conn[t].findOne(ns, BSON("does_not_exist" << i));
            }
        }
    };

    struct IntID{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                conn[0].insert(ns, BSON("_id" << i));
            }
            conn[0].getLastError();
        }

        void run(int t, int n){
            int chunk = iterations / n;
            auto_ptr<DBClientCursor> cursor = conn[t].query(ns, BSONObj(), chunk, chunk*t);
            cursor->itcount();
        }
    };

    struct IntIDRange{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                conn[0].insert(ns, BSON("_id" << i));
            }
            conn[0].getLastError();
        }

        void run(int t, int n){
            int chunk = iterations / n;
            auto_ptr<DBClientCursor> cursor = conn[t].query(ns, BSON("_id" << GTE << chunk*t << LT << chunk*(t+1)));
            cursor->itcount();
        }
    };

    struct IntIDFindOne{
        void reset() {
            clearDB();
            for (int i=0; i < iterations; i++){
                conn[0].insert(ns, BSON("_id" << i));
            }
            conn[0].getLastError();
        }

        void run(int t, int n){
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                conn[t].findOne(ns, BSON("_id" << base + i));
            }
        }
    };

    struct IntNonID{
        void reset() {
            clearDB();
            conn[0].ensureIndex(ns, BSON("x" << 1));
            for (int i=0; i < iterations; i++){
                conn[0].insert(ns, BSON("x" << i));
            }
            conn[0].getLastError();
        }

        void run(int t, int n){
            int chunk = iterations / n;
            auto_ptr<DBClientCursor> cursor = conn[t].query(ns, BSONObj(), chunk, chunk*t);
            cursor->itcount();
        }
    };

    struct IntNonIDRange{
        void reset() {
            clearDB();
            conn[0].ensureIndex(ns, BSON("x" << 1));
            for (int i=0; i < iterations; i++){
                conn[0].insert(ns, BSON("x" << i));
            }
            conn[0].getLastError();
        }

        void run(int t, int n){
            int chunk = iterations / n;
            auto_ptr<DBClientCursor> cursor = conn[t].query(ns, BSON("x" << GTE << chunk*t << LT << chunk*(t+1)));
            cursor->itcount();
        }
    };

    struct IntNonIDFindOne{
        void reset() {
            clearDB();
            conn[0].ensureIndex(ns, BSON("x" << 1));
            for (int i=0; i < iterations; i++){
                conn[0].insert(ns, BSON("x" << i));
            }
            conn[0].getLastError();
        }

        void run(int t, int n){
            int base = t * (iterations/n);
            for (int i=0; i < iterations / n; i++){
                conn[t].findOne(ns, BSON("x" << base + i));
            }
        }
    };

}

namespace{
    struct TheTestSuite : TestSuite{
        TheTestSuite(){
            add< Overhead::DoNothing >();

            add< Insert::Empty >();
            add< Insert::EmptyCapped >();
            add< Insert::JustID >();
            add< Insert::IntID >();
            add< Insert::IntIDUpsert >();
            add< Insert::JustNum >();
            add< Insert::JustNumIndexedBefore >();
            add< Insert::JustNumIndexedAfter >();
            add< Insert::NumAndID >();

            add< Queries::Empty >();
            add< Queries::HundredTableScans >();
            add< Queries::IntID >();
            add< Queries::IntIDRange >();
            add< Queries::IntIDFindOne >();
            add< Queries::IntNonID >();
            add< Queries::IntNonIDRange >();
            add< Queries::IntNonIDFindOne >();

        }
    } theTestSuite;
}

int main(int argc, const char **argv){
    if (argc != 3){
        cout << argv[0] << ": [port] [iterations]" << endl;
        return 1;
    }

    for (int i=0; i < max_threads; i++){
        string errmsg;
        if ( ! conn[i].connect( string( "127.0.0.1:" ) + argv[1], errmsg ) ) {
            cout << "couldn't connect : " << errmsg << endl;
            return 1;
        }
    }

    iterations = atoi(argv[2]);

    theTestSuite.run();

    return 0;
}
