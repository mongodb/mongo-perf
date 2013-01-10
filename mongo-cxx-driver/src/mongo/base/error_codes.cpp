// AUTO-GENERATED FILE DO NOT EDIT
// See src/mongo/base/generate_error_codes.py
/*    Copyright 2012 10gen Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

#include "mongo/base/error_codes.h"

#include <cstring>

namespace mongo {
    const char* ErrorCodes::errorString(Error err) {
        switch (err) {
        case OK: return "OK";
        case InternalError: return "InternalError";
        case BadValue: return "BadValue";
        case DuplicateKey: return "DuplicateKey";
        case NoSuchKey: return "NoSuchKey";
        case GraphContainsCycle: return "GraphContainsCycle";
        case HostUnreachable: return "HostUnreachable";
        case HostNotFound: return "HostNotFound";
        case UnknownError: return "UnknownError";
        case FailedToParse: return "FailedToParse";
        case CannotMutateObject: return "CannotMutateObject";
        case UserNotFound: return "UserNotFound";
        case UnsupportedFormat: return "UnsupportedFormat";
        case Unauthorized: return "Unauthorized";
        case TypeMismatch: return "TypeMismatch";
        case Overflow: return "Overflow";
        case InvalidLength: return "InvalidLength";
        case ProtocolError: return "ProtocolError";
        case AuthenticationFailed: return "AuthenticationFailed";
        case CannotReuseObject: return "CannotReuseObject";
        case IllegalOperation: return "IllegalOperation";
        case EmptyArrayOperation: return "EmptyArrayOperation";
        case InvalidBSON: return "InvalidBSON";
        case AlreadyInitialized: return "AlreadyInitialized";
        case LockTimeout: return "LockTimeout";
        case RemoteValidationError: return "RemoteValidationError";
        default: return "Unknown error code";
        }
    }

    ErrorCodes::Error ErrorCodes::fromString(const StringData& name) {
        if (name == "OK") return OK;
        if (name == "InternalError") return InternalError;
        if (name == "BadValue") return BadValue;
        if (name == "DuplicateKey") return DuplicateKey;
        if (name == "NoSuchKey") return NoSuchKey;
        if (name == "GraphContainsCycle") return GraphContainsCycle;
        if (name == "HostUnreachable") return HostUnreachable;
        if (name == "HostNotFound") return HostNotFound;
        if (name == "UnknownError") return UnknownError;
        if (name == "FailedToParse") return FailedToParse;
        if (name == "CannotMutateObject") return CannotMutateObject;
        if (name == "UserNotFound") return UserNotFound;
        if (name == "UnsupportedFormat") return UnsupportedFormat;
        if (name == "Unauthorized") return Unauthorized;
        if (name == "TypeMismatch") return TypeMismatch;
        if (name == "Overflow") return Overflow;
        if (name == "InvalidLength") return InvalidLength;
        if (name == "ProtocolError") return ProtocolError;
        if (name == "AuthenticationFailed") return AuthenticationFailed;
        if (name == "CannotReuseObject") return CannotReuseObject;
        if (name == "IllegalOperation") return IllegalOperation;
        if (name == "EmptyArrayOperation") return EmptyArrayOperation;
        if (name == "InvalidBSON") return InvalidBSON;
        if (name == "AlreadyInitialized") return AlreadyInitialized;
        if (name == "LockTimeout") return LockTimeout;
        if (name == "RemoteValidationError") return RemoteValidationError;
        return UnknownError;
    }

    ErrorCodes::Error ErrorCodes::fromInt(int code) {
        switch (code) {
        case OK: return OK;
        case InternalError: return InternalError;
        case BadValue: return BadValue;
        case DuplicateKey: return DuplicateKey;
        case NoSuchKey: return NoSuchKey;
        case GraphContainsCycle: return GraphContainsCycle;
        case HostUnreachable: return HostUnreachable;
        case HostNotFound: return HostNotFound;
        case UnknownError: return UnknownError;
        case FailedToParse: return FailedToParse;
        case CannotMutateObject: return CannotMutateObject;
        case UserNotFound: return UserNotFound;
        case UnsupportedFormat: return UnsupportedFormat;
        case Unauthorized: return Unauthorized;
        case TypeMismatch: return TypeMismatch;
        case Overflow: return Overflow;
        case InvalidLength: return InvalidLength;
        case ProtocolError: return ProtocolError;
        case AuthenticationFailed: return AuthenticationFailed;
        case CannotReuseObject: return CannotReuseObject;
        case IllegalOperation: return IllegalOperation;
        case EmptyArrayOperation: return EmptyArrayOperation;
        case InvalidBSON: return InvalidBSON;
        case AlreadyInitialized: return AlreadyInitialized;
        case LockTimeout: return LockTimeout;
        case RemoteValidationError: return RemoteValidationError;
        default:
            return UnknownError;
        }
    }

    bool ErrorCodes::isNetworkError(Error err) {
        switch (err) {
        case HostUnreachable:
        case HostNotFound:
            return true;
        default:
            return false;
        }
    }

}  // namespace mongo
