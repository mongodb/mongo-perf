// index_key.h

/**
*    Copyright (C) 2008 10gen Inc.
*
*    This program is free software: you can redistribute it and/or  modify
*    it under the terms of the GNU Affero General Public License, version 3,
*    as published by the Free Software Foundation.
*
*    This program is distributed in the hope that it will be useful,
*    but WITHOUT ANY WARRANTY; without even the implied warranty of
*    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*    GNU Affero General Public License for more details.
*
*    You should have received a copy of the GNU Affero General Public License
*    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

#pragma once

#include "mongo/pch.h"
#include "diskloc.h"
#include "jsobj.h"
#include <map>

namespace mongo {

    extern const int DefaultIndexVersionNumber;

    const int ParallelArraysCode = 10088;
    
    class Cursor;
    class IndexSpec;
    class IndexType; // TODO: this name sucks
    class IndexPlugin;
    class IndexDetails;
    class FieldRangeSet;

    enum IndexSuitability { USELESS = 0 , HELPFUL = 1 , OPTIMAL = 2 };

    /**
     * this represents an instance of a index plugin
     * done this way so parsing, etc... can be cached
     * so if there is a FTS IndexPlugin, for each index using FTS
     * there will be 1 of these, and it can have things pre-parsed, etc...
     */
    class IndexType : boost::noncopyable {
    public:
        IndexType( const IndexPlugin * plugin , const IndexSpec * spec );
        virtual ~IndexType();

        virtual void getKeys( const BSONObj &obj, BSONObjSet &keys ) const = 0;

        /**
         * Returns the element placed in an index key when indexing a field absent from a document.
         * By default this is a null BSONElement.
         */
        virtual BSONElement missingField() const;

        /* Full semantics of numWanted:
         * numWanted == 0 : Return any number of results, but try to return in batches of 101.
         * numWanted == 1 : Return exactly one result.
         * numWanted  > 1 : Return any number of results, but try to return in batches of numWanted.
         *
         * In practice, your cursor can ignore numWanted, as enforcement of limits is done
         * by the caller.
         */
        virtual shared_ptr<Cursor> newCursor( const BSONObj& query , const BSONObj& order , int numWanted ) const = 0;

        /** optional op : changes query to match what's in the index */
        virtual BSONObj fixKey( const BSONObj& in ) { return in; }

        /** optional op : compare 2 objects with regards to this index */
        virtual int compare( const BSONObj& l , const BSONObj& r ) const;

        /** @return plugin */
        const IndexPlugin * getPlugin() const { return _plugin; }

        const BSONObj& keyPattern() const;

        /* Determines the suitability level of this index for answering a given query. The query is
         * represented as a set of constraints given by a FieldRangeSet, and a desired ordering of
         * the output.
         *
         * Note: it is the responsibility of the caller to pass in the correct FieldRangeSet, which
         * may depend upon whether this is a single or multi-key index at the time of calling.
         */
        virtual IndexSuitability suitability( const FieldRangeSet& queryConstraints ,
                                              const BSONObj& order ) const;

        virtual bool scanAndOrderRequired( const BSONObj& query , const BSONObj& order ) const ;

    protected:
        const IndexPlugin * _plugin;
        const IndexSpec * _spec;
    };

    /**
     * this represents a plugin
     * a plugin could be something like full text search, sparse index, etc...
     * 1 of these exists per type of index per server
     * 1 IndexType is created per index using this plugin
     */
    class IndexPlugin : boost::noncopyable {
    public:
        IndexPlugin( const string& name );
        virtual ~IndexPlugin() {}

        virtual IndexType* generate( const IndexSpec * spec ) const = 0;

        string getName() const { return _name; }

        /**
         * @return new keyPattern
         * if nothing changes, should return keyPattern
         */
        virtual BSONObj adjustIndexSpec( const BSONObj& spec ) const { return spec; }

        /**
         * Hook function to run after an index that uses this plugin is built.
         *
         * This will be called with an active write context (and lock) on the database.
         *
         * @param spec The IndexSpec of the newly built index.
         */
        virtual void postBuildHook( const IndexSpec& spec ) const { }

        // ------- static below -------

        static IndexPlugin* get( const string& name ) {
            if ( ! _plugins )
                return 0;
            map<string,IndexPlugin*>::iterator i = _plugins->find( name );
            if ( i == _plugins->end() )
                return 0;
            return i->second;
        }

        /**
         * @param keyPattern { x : "fts" }
         * @return "" or the name
         */
        static string findPluginName( const BSONObj& keyPattern );

        /**
         * True if is a regular (non-plugin) index or uses a plugin that existed before 2.4.
         * These plugins are grandfathered in and allowed to exist in DBs with
         * PDFILE_MINOR_VERSION_22_AND_OLDER
         */
        static bool existedBefore24(const string& name) {
            return name.empty()
                || name == "2d"
                || name == "geoHaystack"
                || name == "hashed"
                ;
        }

    private:
        string _name;
        static map<string,IndexPlugin*> * _plugins;
    };

    /* precomputed details about an index, used for inserting keys on updates
       stored/cached in NamespaceDetailsTransient, or can be used standalone
       */
    class IndexSpec {
    public:
        enum PluginRules {
            NoPlugins,
            RulesFor22, // if !IndexPlugin::existedBefore24() treat as ascending
            RulesFor24, // allow new plugins but error if unknown
        };

        BSONObj keyPattern; // e.g., { name : 1 }
        BSONObj info; // this is the same as IndexDetails::info.obj()

        IndexSpec()
            : _details(0) , _finishedInit(false) {
        }

        explicit IndexSpec(const BSONObj& k, const BSONObj& m=BSONObj(),
                           PluginRules rules=RulesFor24)
            : keyPattern(k) , info(m) , _details(0) , _finishedInit(false) {
            _init(rules);
        }

        /**
           this is a DiscLoc of an IndexDetails info
           should have a key field
         */
        explicit IndexSpec(const DiskLoc& loc, PluginRules rules=RulesFor24) {
            reset(loc, rules);
        }

        void reset(const BSONObj& info, PluginRules rules=RulesFor24);
        void reset(const IndexDetails * details); // determines rules based on pdfile version
        void reset(const DiskLoc& infoLoc, PluginRules rules=RulesFor24) {
            reset(infoLoc.obj(), rules);
        }

        void getKeys( const BSONObj &obj, BSONObjSet &keys ) const;

        /**
         * Returns the element placed in an index key when indexing a field absent from a document.
         * By default this is a null BSONElement.
         */
        BSONElement missingField() const {
            if ( _indexType.get() )
                return _indexType->missingField();
            return _nullElt;
        }

        string getTypeName() const {
            if ( _indexType.get() )
                return _indexType->getPlugin()->getName();
            return "";
        }

        IndexType* getType() const {
            return _indexType.get();
        }

        const IndexDetails * getDetails() const {
            return _details;
        }

        IndexSuitability suitability( const FieldRangeSet& queryConstraints ,
                                      const BSONObj& order ) const ;

        bool isSparse() const { return _sparse; }

        string toString() const;

    protected:

        int indexVersion() const;
        
        IndexSuitability _suitability( const FieldRangeSet& queryConstraints ,
                                       const BSONObj& order ) const ;

        BSONSizeTracker _sizeTracker;
        vector<const char*> _fieldNames;
        vector<BSONElement> _fixed;

        BSONObj _nullKey; // a full key with all fields null
        BSONObj _nullObj; // only used for _nullElt
        BSONElement _nullElt; // jstNull

        BSONObj _undefinedObj; // only used for _undefinedElt
        BSONElement _undefinedElt; // undefined

        int _nFields; // number of fields in the index
        bool _sparse; // if the index is sparse
        shared_ptr<IndexType> _indexType;
        const IndexDetails * _details;

        void _init(PluginRules rules);

        friend class IndexType;
        friend class KeyGeneratorV0;
        friend class KeyGeneratorV1;
    public:
        bool _finishedInit;
    };


} // namespace mongo
