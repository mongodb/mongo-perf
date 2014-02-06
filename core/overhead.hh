#pragma once

#include "basetest.hh"

using namespace utils;

namespace Overhead {
    // this tests the overhead of the system
    class DoNothing {
        public:
            DoNothing() {};
            ~DoNothing() {};            
            bool readOnly() { return false; }
            void run(int t, int n, Connection *cc) {}
            void reset(Connection *cc) { cc->clearDB(); }
    };
}

