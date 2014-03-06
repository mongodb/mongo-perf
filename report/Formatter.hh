#pragma once

#include <vector>
#include <boost/property_tree/json_parser.hpp>
#include <boost/property_tree/ptree.hpp>
#include <boost/property_tree/exceptions.hpp>

using namespace std;
using namespace boost;

typedef property_tree::ptree json;

/*
 * Base class for CSVFormatter and BSONFormatter
 */
class Formatter {
protected:
    vector<json*>* _json_data;
    Formatter(vector<string>& data);
    Formatter(const Formatter& other) {};
public:
    ~Formatter();
    virtual void write() = 0;
};

/* cross-compatible array length calculation */
template <typename T, size_t N>
size_t countof( T (&array)[N] ) {
    return N;
};
