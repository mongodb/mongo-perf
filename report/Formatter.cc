#include "Formatter.hh"

Formatter::Formatter(vector<string>& data) {
    this->_json_data = new vector<json*>();
    for (vector<string>::const_iterator it = data.begin();
         it != data.end(); ++it) {

        json* tree = new json();
        basic_istringstream<char> iss(*it);
        property_tree::read_json(iss, *tree);
        _json_data->push_back(tree);
    }
}

Formatter::~Formatter() {
    for (vector<json*>::const_iterator it = _json_data->begin();
         it != _json_data->end(); ++it) {
        delete *it;
    }
    delete _json_data;
}
