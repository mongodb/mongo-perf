#ifndef __MONGOPERF_GUARD_TESTBASE__
#define __MONGOPERF_GUARD_TESTBASE__

#ifndef _WIN32
#include <cxxabi.h>
#endif

namespace utils {
    class TestBase {
        public:
            virtual void run(int thread, int nthreads, Connection *cc) = 0;
            virtual void reset(Connection *cc) = 0;
            virtual bool readOnly() = 0; // if true only reset before first run
            virtual string name() = 0;
            virtual ~TestBase() {}
    };

    template <typename T>
    class Test: public TestBase {
        private:
            Connection *cc;
            T test;
            
        public:
            Test() {};
            Test(Connection *cc) {
                // XXX: switch to list initialization.
                this->cc = cc;
            }

            virtual void run(int thread, int nthreads, Connection *cc) {
                test.run(thread, nthreads, cc);
                cc->getLastError(thread);
            }
            
            virtual void reset(Connection *cc){
                test.reset(cc);
                cc->getLastError();
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

                char * niceName = abi::__cxa_demangle(typeid(T).name(), 
                    0, 0, &status);
                if ( ! niceName )
                    return typeid(T).name();

                string s = niceName;
                free(niceName);
                return s;
#endif
            }
    };

    class TestSuite {
        public:
            TestSuite(Connection *cc) {
                // XXX: switch to list initialization
                this->cc = cc;
            }
            
            // XXX: add destructor.
            ~TestSuite() {}
            
            template <typename T>
            void add() {
                _tests.push_back(new Test<T>(cc));
            }
            
            std::vector<BSONObj> run(){
                std::vector<BSONObj> rvec;

                for (vector<TestBase*>::iterator it=_tests.begin(), 
                        end=_tests.end(); it != end; ++it) {
                    TestBase* test = *it;
                    boost::posix_time::ptime startTime, endTime; //reused

                    cerr << "########## " << test->name() << 
                        " ##########" << endl;

                    BSONObjBuilder results;

                    double one_micros;
                    bool resetDone = false;
                    BOOST_FOREACH(int nthreads, thread_nums){

                        if (!test->readOnly() || !resetDone) {
                            test->reset(cc);
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
                                          << "ops_per_sec" << cc->getIterations() / micros
                                          << "speedup" << one_micros / micros
                                          ));
                    }

                    BSONObj out =
                        BSON( "name" << test->name()
                           << "results" << results.obj()
                           );
                    rvec.push_back(out);
                    cout << out.jsonString(Strict) << endl;
                }
                return rvec;
            }
        private:
            Connection *cc;
            vector<TestBase*> _tests;

            void launch_subthreads(int threads, TestBase* test) {
                boost::thread_group tgroup;

                assert(threads > 0);

                for (int i = 0; i < threads; ++i) {
                    tgroup.create_thread(boost::bind(&TestBase::run, test, i,
                        threads, cc));
                }
                
                tgroup.join_all();
            }
    };
} // namespace tests

#endif //__MONGOPERF_GUARD_TESTBASE__
