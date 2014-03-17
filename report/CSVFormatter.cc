#include <fstream>
#include <iostream>
#include <boost/format.hpp>
#include "CSVFormatter.hh"

using namespace std;
using namespace boost;

/*
 * CSV format:
 *
 * (first line of headings)
 * benchmark1-name, k-threads-result1, k-threads-result2, ..., j-threads-result1, ...
 * benchmark2-name, k-threads-result1, k-threads-result2, ..., j-threads-result1, ...
 * ...
 */
void CSVFormatter::write() {
    vector<vector<string> > csv_data;
    string thread_counts[] = {"1", "2", "4", "6", "8", "12", "16"};

    // Add headings for CSV
    vector<string> headings;
    headings.push_back("benchmark-name");
    for (unsigned int i = 0; i < countof(thread_counts); i++) {
        string tc = thread_counts[i];
        string timestr = str(format("%1%-threads-time") % tc);
        string opsstr = str(format("%1%-threads-ops_per_sec") % tc);
        string speedstr = str(format("%1%-threads-speedup") % tc);

        headings.push_back(timestr);
        headings.push_back(opsstr);
        headings.push_back(speedstr);
    }
    csv_data.push_back(headings);

    // each benchmark
    for (vector<json*>::const_iterator it = _json_data->begin();
         it != _json_data->end(); ++it) {

        vector<string> row_data;

        // name of the benchmark
        string name = (*it)->get<string>("name");
        row_data.push_back(name);
        
        // benchmark results, nested within the document
        json results = (*it)->get_child("results");

        // get each result datum, add to csv_data
        for (unsigned int i = 0; i < countof(thread_counts); i++) {
            string tc = thread_counts[i];

            json thread_data = results.get_child(tc);

            row_data.push_back(thread_data.get<string>("time"));
            row_data.push_back(thread_data.get<string>("ops_per_sec"));
            row_data.push_back(thread_data.get<string>("speedup"));
        }

        // next row of CSV
        csv_data.push_back(row_data);
    }

    ofstream output_file;
    output_file.open(_filename);
    
    // just print stdout the CSV for now
    for (vector<vector<string> >::const_iterator row = csv_data.begin();
         row != csv_data.end(); ++row) {

        for (unsigned int i=0; i<row->size(); ++i) {
            string datum = (*row)[i];

            if (i == row->size() - 1) {
                output_file << datum << endl;
            } else {
                output_file << datum << ",";
            }
        }
    }
}
