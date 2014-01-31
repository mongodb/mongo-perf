#ifndef __MONGOPERF_GUARD_UTILS__
#define __MONGOPERF_GUARD_UTILS__

#include <mongo/client/dbclient.h>
#include <iostream>
#include <cassert>
#include <cstdlib>
#include <vector>
#include <boost/date_time/posix_time/posix_time.hpp>
#include <boost/bind.hpp>
#include <boost/foreach.hpp>
#include <boost/lexical_cast.hpp>
#include <boost/thread.hpp>

using namespace mongo;
using namespace std;

namespace utils {
    // XXX: move to where they belong.
    const int thread_nums[] = {1,2,4,6,8,12,16};
    const int max_threads = 16;
    const char* _db = "benchmarks";
    const char* _coll = "collection";

    class Connection {
        private:
            string conn_string;
            DBClientConnection _conn[max_threads];

            bool multi_db;
            bool batch;
            
            int _iterations;

            // Authentication stuffs.
            string _username;
            string _password;
            
            string ns[max_threads];
            
            string nsToDatabase(string ns) {
                size_t i = ns.find('.');
                if (i == string::npos) {
                    return ns;
                }
                return ns.substr(0, i);
            }

            string nsToCollection(string ns) {
                size_t i = ns.find('.');
                assert(i != string::npos);
                return ns.substr(i + 1);
            }

        public:
            // XXX: add constructor/destructor
            Connection(string& conn_string, int& iterations,
                bool& multi_db, string& username, string& password, bool& batch) {
                    // XXX: move to list initialization
                    this->conn_string = conn_string;
                    this->_iterations = iterations;
                    this->multi_db = multi_db;
                    this->_username = username;
                    this->_password = password;
                    this->batch = batch;
            };
            
            ~Connection() { }

            //XXX : should be moved to the constructor?
             void init(void) {
                for (int i=0; i < max_threads; i++){
                    string dbname = _db + BSONObjBuilder::numStr(i);
                    ns[i] = dbname + '.' + _coll;
                    string errmsg;
                    if (!_conn[i].connect(conn_string, errmsg)) {
                        cerr << "couldn't connect : " << errmsg << endl;
                        // XXX: this should throw an exception.
                        // return EXIT_FAILURE;
                    }

                    // Handle authentication if necessary
                    if (!_username.empty()) {
                        cerr << "authenticating as user: " << _username << 
                            " with password: " << _password << endl;
                        if (!_conn[i].auth((multi_db ? dbname : "admin"), 
                            _username, _password, errmsg)) {
                            cerr << "Auth failed : " << errmsg << endl;
                            // XXX: this should throw an exception
                            // return EXIT_FAILURE;
                        }
                    }
                }
            }

            // Getter-setter methods
            int getIterations(void) {
                return _iterations;
            }

            bool getMultiDB(void) {
                return multi_db;
            }

            void createCollection(int thread, int size, bool capped) {
                _conn[thread].createCollection(ns[thread], size,
                    capped);
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

            BSONObj buildBatchedInsertRequest(int thread, BSONObj obj) {
                BSONObjBuilder builder;
                
                if (!multi_db) {
                    builder.append("insert", nsToCollection(ns[0]));
                }
                else {
                    builder.append("insert", nsToCollection(ns[thread]));
                }
                BSONArrayBuilder docBuilder(
                    builder.subarrayStart("documents"));
                docBuilder.append(obj);
                docBuilder.done();
                return builder.obj();
            }

            BSONObj buildBatchedInsertRequest(int thread,
                const vector<BSONObj>& obj) {
                BSONObjBuilder builder;
                if (!multi_db) {
                    builder.append("insert", nsToCollection(ns[0]));
                }
                else {
                    builder.append("insert", nsToCollection(ns[thread]));
                }
                BSONArrayBuilder docBuilder(
                    builder.subarrayStart("documents"));
                for (vector<BSONObj>::const_iterator it = obj.begin();
                    it != obj.end(); ++it) {
                    docBuilder.append(*it);
                }
                docBuilder.done();
                return builder.obj();
            }

            template <typename VectorOrBSONObj>
            void insert(int thread, const VectorOrBSONObj& obj) {
                BSONObj result;
                BSONObj x;

                if (!multi_db) {
                    if (batch) {
                        x = buildBatchedInsertRequest(thread, obj);
                        _conn[max(0, thread)].runCommand(nsToDatabase(ns[0]),
                            x, result);
                    }
                    else {
                        _conn[max(0,thread)].insert(ns[0], obj);
                    }
                }
                else if (thread != -1) {
                    if (batch) {
                        x = buildBatchedInsertRequest(thread, obj);
                        _conn[thread].runCommand(nsToDatabase(ns[thread]), x,
                            result);
                    }
                    else {
                        _conn[thread].insert(ns[thread], obj);
                    }
                    return;
                }
                else {
                    for (int t=0; t<max_threads; t++) {
                        insert(t, obj);
                    }
                }
            }

            void remove(int thread, const BSONObj& qObj, 
                        bool onlyOne=false) {
                assert(thread != -1);
                _conn[thread].remove(ns[multi_db?thread:0], qObj, onlyOne);
            }

            void update(int thread, const BSONObj& qObj,
                        const BSONObj uObj, bool upsert=false,
                        bool multi=false) {
                assert(thread != -1); // cant run on all conns
                _conn[thread].update(ns[multi_db?thread:0], qObj, uObj, upsert, multi);
                return;
            }

            void findOne(int thread, const BSONObj& obj,
                        const BSONObj& projection = BSONObj()) {
                assert(thread != -1); // cant run on all conns
                _conn[thread].findOne(ns[multi_db?thread:0], obj, &projection);
                return;
            }

            auto_ptr<DBClientCursor> query(int thread, const Query& q,
                                            int limit=0, int skip=0,
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
            
            void clearDB(void){
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
        };
} // namespace utils

#endif // __MONGOPERF_GUARD_UTILS__
