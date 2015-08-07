import argparse
import json
import sys
import itertools

# Example usage:
# perf_regression_check.py -f history_file.json --rev 18808cd923789a34abd7f13d62e7a73fafd5ce5f
# Loads the history json file, and looks for regressions at the revision 18808cd...
# Will exit with status code 1 if any regression is found, 0 otherwise.

def main(args):
    parser = argparse.ArgumentParser()
    parser.add_argument("-f", "--file", dest="file", help="path to json file containing history data")
    parser.add_argument("--rev", dest="rev", help="revision to examine for regressions")
    args = parser.parse_args()
    j = get_json(args.file)
    h = History(j)
    testnames = h.testnames()
    failed = False

    for test in testnames:
        this_one = h.seriesAtRevision(test, args.rev)
        print "checking %s.." % (test)
        if not this_one:
            print "\tno data at this revision, skipping"
            continue

        #If the new build is 10% lower than the target (3.0 will be used as the baseline for 3.2 for instance), consider it regressed.
        previous = h.seriesItemsNBefore(test, args.rev, 1)
        if not previous:
            print "\tno previous data, skipping"
            continue
        previous = previous[0]
        if previous["max"] - this_one["max"] >= (.0001 * previous["max"]):
            print "\tregression found: drop from %s (commit %s) to %s" % (previous["max"], previous["revision"][:5], this_one["max"])
            Failed = true
        else:
            print "\tno regression"

    if failed:
        sys.exit(1)
    else:
        sys.exit(0)

def get_json(filename):
    jf = open(filename, 'r')
    json_obj = json.load(jf)
    return json_obj

class History(object):
    def __init__(self, jsonobj):
        self._raw = sorted(jsonobj, key=lambda d: d["order"])

    def testnames(self):
        return set(list(itertools.chain.from_iterable([[z["name"] for z in c["data"]["results"]] for c in self._raw])))

    def seriesAtRevision(self, testname, revision):
        s = self.series(testname)
        for result in s:
            if result["revision"] == revision:
                return result
        return None

    def seriesItemsNBefore(self, testname, revision, n):
        """
            Returns the 'n' items in the series under the given test name that 
            appear prior to the specified revision.
        """
        results = []
        found = False
        s = self.series(testname)
        for result in s:
            if result["revision"] == revision:
                found = True
                break
            results.append(result)

        if found:
            return results[-1*n:]
        return []

    def series(self, testname):
        for commit in self._raw:
            # get a copy of the samples for those whose name matches the given testname
            matching = filter( lambda x: x["name"]==testname, commit["data"]["results"])
            if matching:
                result = matching[0]
                result["revision"] = commit["revision"]
                result["order"] = commit["order"]
                result["max"] = max(f["ops_per_sec"] for f in result["results"].values() if type(f) == type({}))
                yield result


class TestResult:
    def __init__(self, json):
        self._raw = json

    #def max(self):




if __name__ == '__main__': 
    main(sys.argv[1:])
