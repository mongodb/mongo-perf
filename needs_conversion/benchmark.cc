#include "bench.hh"

namespace po = boost::program_options;
using namespace std;
using namespace mongo;
using namespace utils;

int main(int argc, char **argv) {
    try {
        po::variables_map options_vars;
        string conn_string;
        string password;
        string testname;
        string username;
        int iterations;
        bool multi_db = false;
        bool batch = false;
        bool writeConcern = false;
        bool raw = false;
 
        po::options_description display_options("Program options");
        display_options.add_options()
            ("help", "Display help information");
        po::options_description all_options("All options");
        all_options.add_options()
            ("connection-string",   po::value<string>(),                "Connection string")
            ("iterations",          po::value<int>(),                   "Number of iterations")
            ("multi-db",            po::bool_switch(),                  "MultiDB mode")
            ("username",            po::value<string>(),                "Username (auth)")
            ("password",            po::value<string>(),                "Password (auth)")  
            ("batch",               po::bool_switch(),                  "Batched command")
            ("writeConcern",        po::bool_switch(),                  "WriteConcern ON/OFF")
            ("testname",            po::value<string>(),                "Tests to run")
            ("raw",                 po::bool_switch(),                  "Raw output");

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

        if (options_vars.count("connection-string") < 1 ||
            options_vars.count("iterations") < 1) {
            conn_string = "localhost:27017";
            iterations = 100000;
        }
        else {
            conn_string = options_vars["connection-string"].as<string>();
            iterations = options_vars["iterations"].as<int>();
        }

        if (options_vars.count("multi-db")) {
            multi_db = options_vars["multi-db"].as<bool>();
        }

        if (options_vars.count("username")) {
            username = options_vars["username"].as<string>();
        }

        if (options_vars.count("password")) {
            password = options_vars["password"].as<string>();
        }

        if (options_vars.count("batch")) {
            batch = options_vars["batch"].as<bool>();
        }

        if (options_vars.count("writeConcern")) {
            writeConcern = options_vars["writeConcern"].as<bool>();
        }

        if (options_vars.count("testname")) {
            testname = options_vars["testname"].as<string>();
            if (!(testname == "overhead" || testname == "insert" ||
                testname == "remove" || testname == "update" ||
                testname == "query" || testname == "command")) {
                cout << "Testname is not valid" << endl;
                return EXIT_FAILURE;
            }
        }
        else {
            testname = "";
        }

        if (options_vars.count("raw")) {
            raw = options_vars["raw"].as<bool>();
        }

        Connection *conn = new Connection(conn_string, iterations,
            multi_db, username, password, batch, writeConcern, raw);
        conn->init();
        
        TestSuite *t = new TestSuite(conn);

        if (testname == "" || testname == "overhead") {
            t->add< Overhead::DoNothing >();
        }

        if (testname == "" || testname == "insert") {
            t->add< Insert::Empty >();
            t->add< Insert::EmptyBatched<2> >();
            t->add< Insert::EmptyBatched<10> >();
            t->add< Insert::EmptyBatched<100> >();
            t->add< Insert::EmptyBatched<1000> >();
            t->add< Insert::EmptyCapped >();
            t->add< Insert::JustID >();
            t->add< Insert::IntID >();
            t->add< Insert::IntIDUpsert >();
            t->add< Insert::JustNum >();
            t->add< Insert::JustNumIndexedBefore >();
            t->add< Insert::JustNumIndexedAfter >();
            t->add< Insert::NumAndID >();
        }

        if (testname == "" || testname == "remove") {
            t->add< Remove::IntID >();
            t->add< Remove::IntIDRange >();
            t->add< Remove::IntNonID >();
            t->add< Remove::IntNonIDRange >();
        }

        if (testname == "" || testname == "update") {
            t->add< Update::IncNoIndexUpsert >();
            t->add< Update::IncWithIndexUpsert >();
            t->add< Update::IncNoIndex >();
            t->add< Update::IncWithIndex >();
            t->add< Update::IncNoIndex_QueryOnSecondary >();
            t->add< Update::IncWithIndex_QueryOnSecondary >();
            t->add< Update::IncFewSmallDocLongFields >();
            t->add< Update::IncFewLargeDocLongFields >();
            t->add< Update::IncFewSmallDoc >();
            t->add< Update::IncFewLargeDoc >();
            t->add< Update::FieldAtOffset<0> >();
            t->add< Update::FieldAtOffset<10> >();
            t->add< Update::FieldAtOffset<100> >();
            t->add< Update::FieldAtOffset<256> >();
            t->add< Update::FieldAtOffset<511> >();
            t->add< Update::MmsIncShallow1 >();
            t->add< Update::MmsIncShallow2 >();
            t->add< Update::MmsIncDeep1 >();
            t->add< Update::MmsIncDeepSharedPath2 >();
            t->add< Update::MmsIncDeepSharedPath3 >();
            t->add< Update::MmsIncDeepDistinctPath2 >();
            t->add< Update::MmsIncDeepDistinctPath3 >();
        }

        if (testname == "" || testname == "query") {
            t->add< Queries::Empty >();
            t->add< Queries::HundredTableScans >();
            t->add< Queries::IntID >();
            t->add< Queries::IntIDRange >();
            t->add< Queries::IntIDFindOne >();
            t->add< Queries::IntNonID >();
            t->add< Queries::IntNonIDRange >();
            t->add< Queries::IntNonIDFindOne >();
            t->add< Queries::RegexPrefixFindOne >();
            t->add< Queries::TwoIntsBothBad >();
            t->add< Queries::TwoIntsBothGood >();
            t->add< Queries::TwoIntsFirstGood >();
            t->add< Queries::TwoIntsSecondGood >();
            t->add< Queries::ProjectionNoop >();
            t->add< Queries::ProjectionCoverd >();
            t->add< Queries::ProjectionNoopFindOne >();
            t->add< Queries::ProjectionSingle >();
            t->add< Queries::ProjectionSingleFindOne >();
            t->add< Queries::ProjectionSingleFindOneCovered >();
            t->add< Queries::ProjectionUnderscoreId >();
            t->add< Queries::ProjectionUnderscoreIdFindOne >();
            t->add< Queries::ProjectionWideDocNarrowProjection >();
            t->add< Queries::ProjectionWideDocNarrowProjectionFindOne >();
            t->add< Queries::ProjectionWideDocWideProjection >();
            t->add< Queries::ProjectionWideDocWideProjectionFindOne >();
            t->add< Queries::NestedProjectionFindOne<10, 10> >();
            t->add< Queries::NestedProjectionCursor<10, 10> >();
            t->add< Queries::ProjectionElemMatch >();
            t->add< Queries::ProjectionElemMatchFindOne >();
            t->add< Commands::CountsFullCollection >();
        }

        if (testname == "" || testname == "command") {
            t->add< Commands::CountsIntIDRange >();
            t->add< Commands::FindAndModifyInserts >();
            t->add< Commands::DistinctWithIndex >();
            t->add< Commands::DistinctWithoutIndex >();
        }

        std::vector<BSONObj> res = t->run();
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
