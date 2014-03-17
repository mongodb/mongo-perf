#include <mongo/client/dbclient.h>
#include <exception>
#include <iostream>
#include <vector>
#include <boost/program_options.hpp>
#include "../core/util.hh"
#include "CSVFormatter.hh"

namespace po = boost::program_options;
using namespace std;
using namespace mongo;

int main(int argc, char **argv) {
    try {

        // Program options
        po::variables_map options_vars;
        po::options_description display_options("Program options");
        display_options.add_options()
            ("help", "Display help information");
        po::options_description all_options("All options");
        all_options.add_options()
            ("csv", po::value<string>(), "CSV file output")
            ("connection-string", po::value<string>(),
             "Connection string to UNIX socket or MongoDB");

        all_options.add(display_options);

        po::store(po::command_line_parser(argc, argv)
                  .options(all_options)
                  .run(), options_vars);
        po::notify(options_vars);

        // help
        if (options_vars.count("help")) {
            cout << all_options << endl;
            return EXIT_SUCCESS;
        }

        // Make sure we have selected format(s)
        if (options_vars.count("csv") == 0 &&
            options_vars.count("connection-string") == 0) {

            cerr << "You should select one or more of --csv, --connection-string"
                 << endl;
            cerr << all_options << endl;
            return EXIT_FAILURE;
        }

        // get data from STDIN
        vector<string> data;
        for (string s; getline(cin, s); ) {
            data.push_back(s);
        }

        // connection-string
        if (options_vars.count("connection-string")) {
            string conn_string = options_vars["connection-string"].as<string>();

            DBClientConnection* conn = new DBClientConnection();
            try {
                conn->connect(conn_string);
            } catch (mongo::UserException const & e) {
                cerr << e.what() << endl;
                delete conn;
                return EXIT_FAILURE;
            }
            return EXIT_SUCCESS;
        }

        if (options_vars.count("csv")) {
            string filename = options_vars["csv"].as<string>();

            CSVFormatter formatter(filename, data);
            formatter.write();

            return EXIT_SUCCESS;
        }

    } catch (po::error const & e) {
        cerr << "error: " << e.what() << endl;
        cerr << "try " << argv[0] << "--help" << endl;
        return EXIT_FAILURE;
    } catch (std::exception const & e) {
        cerr << "exception: " << e.what() << endl;
        return EXIT_FAILURE;
    }
}
