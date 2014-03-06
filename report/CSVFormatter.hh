#pragma once

#include <iostream>
#include <vector>
#include "Formatter.hh"

using namespace std;
using namespace boost;

class CSVFormatter : public Formatter {
private:
    string _filename;
    vector<string> s;
protected:
    CSVFormatter(const CSVFormatter& other) : Formatter(other) {};
public:
    CSVFormatter(const string filename, vector<string>& data) :
        Formatter(data), _filename(filename) { };
    void write();
};
