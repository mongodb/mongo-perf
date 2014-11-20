<!doctype html>
<html lang="us">
    <head>
        <meta charset="utf-8">
        <title>MongoDB Performance Benchmarks</title>
        <link href="static/css/jquery-ui-1.10.1.custom.min.css" rel="stylesheet">
        <link href="static/DataTables-1.10.4/media/css/jquery.dataTables.min.css" rel="stylesheet">
        <link href="static/bootstrap-3.3.0-dist/css/bootstrap.min.css" rel="stylesheet">
        <link href="static/font-awesome-4.2.0/css/font-awesome.min.css" rel="stylesheet">
        <link href="static/css/main.css" rel="stylesheet">
        <script type="text/javascript" src="static/js/jquery-1.9.1.min.js"></script>
        <script type="text/javascript" src="static/js/jquery-ui-1.10.1.custom.min.js"></script>
        <script type="text/javascript" src="static/bootstrap-3.3.0-dist/js/bootstrap.min.js"></script>
        <script type="text/javascript" src="static/DataTables-1.10.4/media/js/jquery.dataTables.min.js"></script>
        <script type="text/javascript" src="static/js/perf_lib.js"></script>
        <script type="text/javascript" src="static/js/jquery.dataTables.min.js"></script>
        <script type="text/javascript" src="static/js/dygraph-combined.js"></script>
        <script type="text/javascript" src="static/js/mongo-perf.js"></script>
        <script>
            var numGraphs = {{len(results)}};
            var even_spread = true;
            var reloadlist = [];
            var dygraphs = [];
            var dycolors = ["#e82924", "#008e45", "#1258ab", "#f67d02",
                "#672794", "#a41b1c", "#b63395", "#010202",
                "#01FF02", "#FFF42A", "#01D3CC", "#1E83FF",
                "#AA7942", "#AA66FF", "#3BCC75", "#929292"];
        </script>
    </head>
    <body>
        <div id="wrapper">
            <div class="container-fluid">
                <div class="row">
                    <div class="navbar navbar-default navbar-fixed-top col-xs-12" role="navigation">
                            <div class="navbar-header">
                                <button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
                                    <span class="sr-only">Toggle navigation</span>
                                    <span class="icon-bar"></span>
                                    <span class="icon-bar"></span>
                                    <span class="icon-bar"></span>
                                </button>
                                <a class="navbar-brand" href="#">MongoDB: mongo-perf benchmark results</a>
                            </div>
                            <div class="navbar-collapse collapse">
                                <ul class="nav navbar-nav">
                                    <li><a href="/">Home</a></li>
                                </ul>
                            </div>

                    </div>
                </div>
                <div class="mainbody row">
                    <div class="col-md-2">
                        <div class="sidebar affix" data-spy="affix" data-offset-top="60">
                            <div>
                                <div class="btn-group" role="group" aria-label="...">
                                    %if use_dates:
                                    <button onclick='useThreads()' class="btn btn-default">Use Threads</button>
                                    %else:
                                    <button onclick='useTime()' class="btn btn-default">Use Time</button>
                                    %end
                                    <button id='tablesbutton' onclick='showTablesClicked()' class="btn btn-default">Show Tables</button>
                                </div>
                            </div>
                            <br/>
                            <div style="clear: left">
                                <label for="filter">Filter:</label>
                                <input type="search" name="filter" class="filter-input form-control input-sm clearable" value=""/>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-10" role="main">
                        %import urllib
                        %j=0
                        %for k, (outer_result, dygraph_data) in enumerate(zip(results, dygraph_results)):
                        <div class="row">
                            <div data-filterable="{{outer_result['name'].lower()}}"  class="test-entry">
                                <div class="row">
                                    <div class="col-md-12">
                                        <div class="row">
                                            <div class="col-xs-12">
                                                <div class="row">
                                                    <div class="col-md-6">
                                                        <div class="btn-group btn-group-xs" role="group">
                                                            <button id='table{{k}}button' onclick='showTableByIDClicked("{{k}}")' class="btn btn-default test-buttons">
                                                                <span class="fa-stack">
                                                                    <i class="fa fa-database"></i>
                                                                    <i class="ban-i fa fa-stack-2x text-danger"></i>
                                                                </span>
                                                            </button>
                                                        </div>
                                                        <h3 class="test-title" id="{{outer_result['name']}}"><a href="https://github.com/search?q={{outer_result['name'][outer_result['name'].rfind(":") + 1:]}}+repo%3Amongodb%2Fmongo-perf&amp;type=Code&amp;ref=searchresults" target="_blank">{{outer_result['name']}}</a></h3>

                                                    </div>

                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-xs-11">
                                        <table class="table table-striped table-condensed table-bordered" id="table-{{k}}" style="display: none;">
                                            <thead>
                                            <tr>
                                                %for thread in threads:
                                                <th>{{thread}} thread{{'' if thread == 1 else 's'}}</th>
                                                %end
                                            </tr>
                                            </thead>
                                            <tbody>
                                            %for i, result in enumerate(outer_result['results']):
                                            <tr>
                                                <td colspan="{{len(threads)}}"><small><strong>{{result['label']}} - {{result['version']}} - {{result['date']}} - <a href="https://github.com/mongodb/mongo/commit/{{result['commit']}}" target="_blank">{{result['commit'][:7]}}</a></strong></small></td>
                                            </tr>
                                            <tr>
                                                %for thread in threads:
                                                %if str(thread) in result:
                                                <td>{{"{0:.2f}".format(result[str(thread)]["ops_per_sec"])}} <br/>
                                                    &sigma; =
                                                    {{"{0:.2f}".format(result[str(thread)]["standardDeviation"])}}</td>
                                                %else:
                                                <td></td>
                                                %end
                                                %end
                                            </tr>
                                            %end
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <script>
                                    num_map = {};
                                    %for i, (result) in enumerate(outer_result['results']):
                                    var commitdate = new Date("{{result['date']}}");
                                    var commitversion = "{{result['version']}}";
                                    if(commitversion.indexOf("pre") >= 0) {
                                        num_map[{{i + 1}}] = "{{result['commit'][:7]}}";
                                    } else {
                                        num_map[{{i + 1}}] = "{{result['version']}}";
                                    }
                                    %end
                                </script>
                                <div class="row">
                                    %if use_dates:
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="dygraph-wrapper">
                                                <div id="graph_time-{{k}}" class="graph" style="height:300px; max-width:600px;"></div>
                                            </div>
                                        </div>
                                        <div class="col-xs-2">
                                            <div id="legendContainer_{{k}}" class="legend-box">
                                                %for s, entry in enumerate(dygraph_data['labels_list'][1:]):
                                                <div class="chart-entry" id="entry_{{k}}">
                                                    <div class="chart-info chart-box"></div>
                                                    <input class="chart-info" type=checkbox checked onClick="dyToggle({{k}}, {{s}}, this)">
                                                    <label>{{entry}}</label>
                                                </div>
                                                %end
                                            </div>
                                            <div class="dygraph-labels" id="graph-labels-time-{{k}}"></div>
                                        </div>
                                    </div>
                                    <script>
                                        timegraph = date_graph("time-{{k}}",get_date_data({{!dygraph_data['data']}}),{{!dygraph_data['labels_json']}},num_map);
                                        dygraphs.push(timegraph);
                                    </script>
                                    %else:
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="dygraph-wrapper">
                                                <div id="graph_threads-{{k}}" class="graph" style="height:300px;width:600px;"></div>
                                            </div>
                                        </div>
                                        <div class="col-xs-2">
                                            <div id="legendContainer_{{k}}" class="legend-box">
                                                %for s, entry in enumerate(dygraph_data['labels_list'][1:]):
                                                <div class="chart-entry" id="entry_{{k}}">
                                                    <div class="chart-info chart-box"></div>
                                                    <input class="chart-info" type=checkbox checked onClick="dyToggle({{k}}, {{s}}, this)">
                                                    <label>{{entry}}</label>
                                                </div>
                                                %end
                                            </div>
                                            <div class="dygraph-labels" id="graph-labels-threads-{{k}}"></div>
                                        </div>
                                    </div>
                                    <script>
                                        threadsgraph = thread_graph("threads-{{k}}",{{!dygraph_data['data']}},{{!dygraph_data['labels_json']}},num_map);
                                        dygraphs.push(threadsgraph);
                                    </script>
                                    %end
                                    <div class="row">
                                        <div class="col-md-8 col-xs-offset-1">

                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        %end
                    </div>
                </div>
            </div>
        </div>
    </body>
</html>
%# vim: set ft=html:
