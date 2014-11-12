<!doctype html>
<html lang="us">
    <head>
        <meta charset="utf-8">
        <title>MongoDB Performance Benchmarks</title>
        <link href="static/css/jquery-ui-1.10.1.custom.min.css" rel="stylesheet">
        <link rel="stylesheet" href="static/css/page.css">
        <link href="static/css/perf_style.css" rel="stylesheet">
        <link href="static/bootstrap-3.3.0-dist/css/bootstrap.min.css" rel="stylesheet">
        <script type="text/javascript" src="static/js/jquery-1.9.1.min.js"></script>
        <script type="text/javascript" src="static/js/jquery-ui-1.10.1.custom.min.js"></script>
        <script type="text/javascript" src="static/bootstrap-3.3.0-dist/js/bootstrap.js"></script>
        <script type="text/javascript" src="static/js/perf_lib.js"></script>
        <script type="text/javascript" src="static/js/jquery.dataTables.min.js"></script>
        <script type="text/javascript" src="static/js/dygraph-combined.js"></script>
        <script type="text/javascript" src="static/js/mongo-perf.js"></script>
        <script>
            var numGraphs = {{len(results)}};
            var even_spread = true;
            reloadlist = [];
            $(document).ready(function(){
                $('table').dataTable({
                        "bPaginate": false,
                        "bLengthChange": false,
                        "bFilter": false,
                        "bInfo": false,
                        "bAutoWidth": true
                });
                //hideTablesClicked();
            });

            var dygraphs = [];
            var dycolors = ["#7BBADE", "#93DE7F", "#F29E4A", "#FF7050",
                            "#FFEC1E", "#0A79BD", "#00B215", "#BAA900",
                            "#A34A00", "#C21F00", "#222222", "#FF44EE",
                            "#FF5A00", "#AA66FF", "#3BCC75", "#29190F"];


        </script>
    </head>
    <body>
    <div class="container">
        <div class="navbar navbar-default navbar-fixed-top" role="navigation">
            <div class="container">
                <div class="navbar-header">
                    <button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
                        <span class="sr-only">Toggle navigation</span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                    </button>
                    <a class="navbar-brand" href="#">MongoDB Benchmark Results</a>
                </div>
                <div class="navbar-collapse collapse">
                    <ul class="nav navbar-nav">
                        <li><a href="/">Home</a></li>
                    </ul>
                </div>
                <!--/.nav-collapse -->
            </div>
        </div>
        <div class="row">
        <div class="col-md-10" role="main">
        %if use_dates:
        <button onclick='useThreads()' >Use Threads</button>
        %else:
        <button onclick='useTime()' >Use Time</button>
        %end

        <button id='tablesbutton' onclick='showTablesClicked()'>Show Tables</button>

        <br />
        %import urllib
        %for k, (outer_result, dygraph_data) in enumerate(zip(results, dygraph_results)):
        <div data-filterable="{{outer_result['name'].lower()}}"  class="test-entry">
        <h2 id="{{outer_result['name']}}"><a href="https://github.com/search?q={{outer_result['name'][outer_result['name'].rfind(":") + 1:]}}+repo%3Amongodb%2Fmongo-perf&amp;type=Code&amp;ref=searchresults" target="_blank">{{outer_result['name']}}</a></h2>
        <button id='table{{k}}button' onclick='showTableByIDClicked("{{k}}")'>Show Table</button>
        <table class="table table-striped" id="table-{{k}}" style="display: none;">
            <thead>
                <tr>
                    <th style="width: 5%">Num</th>
                    <th style="width: 15%">Label</th>
                    <th style="width: 10%">Platform</th>
                    <th style="width: 10%">Version</th>
                    <th style="width: 10%">Date</th>
                    <th style="width: 10%">Commit</th>
                    %for thread in threads:
                    <th>{{thread}} thread{{'' if thread == 1 else 's'}}</th>
                    %end
                </tr>
            </thead>
            <tbody>
                %for i, result in enumerate(outer_result['results']):
                <tr>
                    <td>{{i+1}}</td>
                    <td>{{result['label']}}</td>
                    <td>{{result['platform']}}</td>
                    <td>{{result['version']}}</td>
                    <td>{{result['date']}}</td>
                    <td><a href="https://github.com/mongodb/mongo/commit/{{result['commit']}}" target="_blank">{{result['commit'][:7]}}</a></td>
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
        <br/>
        <div class="container">
        <div class="data-filterable dygraph-wrapper">
          <div id="graph_{{k}}" class="graph" style="width:600px;height:300px;"></div>
        </div>
        <script>
        var num_map_{{k}} = {}
        %for i, result in enumerate(outer_result['results']):
        var commitdate = new Date("{{result['date']}}");
        var commitversion = "{{result['version']}}"
        if(commitversion.indexOf("pre") >= 0) {
            num_map_{{k}}[{{i + 1}}] = "{{result['commit'][:7]}}";
        } else {
            num_map_{{k}}[{{i + 1}}] = "{{result['version']}}";
        }
        %end
        %if use_dates:
            var date_data_{{k}} = get_date_data({{!dygraph_data['data']}});
        %end
        //TODO parameterize
        function dygraph_ready_{{k}}() {
          var dygraph_{{k}} = new Dygraph(
            $('#graph_{{k}}')[0],
            %if use_dates:
                date_data_{{k}},
            %else:
                {{!dygraph_data['data']}},
            %end
            {
              hideOverlayOnMouseOut: false,
              labels: {{!dygraph_data['labels_json']}},
              strokeWidth: 3, //width of lines connecting data points
              colors: dycolors,
              labelsDiv: "graph-labels-{{k}}",
              includeZero: true, //ensure y-axis starts at 0
              xRangePad: 5,
              errorBars: true,
              fillAlpha: 0.50,
              connectSeparatedPoints: true,
              %if use_dates:
              axes: {
                x: {
                  axisLabelFormatter: function(x) {
                    var xval = parseFloat(x);
                    var xfloor = parseInt(x);
                    if(xval === xfloor) {
                        return num_map_{{k}}[xval];
                    } else {
                        return "";
                    }
                  },
                  valueFormatter: function(x) {
                    return num_map_{{k}}[x];
                  }
                }
              },
              xlabel: 'Commit Date' //label for x-axis
              %else:
              xlabel: 'Threads' //label for x-axis
              %end
            });
          dygraphs.push(dygraph_{{k}});

          //color label boxes properly
          $("#entry_{{k}} .chart-box").each(function(idx){
            $(this).css("background-color", dycolors[idx % dycolors.length]);
          });

        };
        $("#graph-labels-{{k}}").ready(dygraph_ready_{{k}});

        </script>
        <div id="legendContainer_{{k}}" class="legend-box">
          %for s, entry in enumerate(dygraph_data['labels_list'][1:]):
          <div class="chart-entry" id="entry_{{k}}">
            <div class="chart-info chart-box"></div>
            <input class="chart-info" type=checkbox checked onClick="dyToggle({{k}}, {{s}}, this)">
            <label>{{entry}}</label>
          </div>
          %end
        </div>
        <div class="dygraph-labels" id="graph-labels-{{k}}"></div>
        </div>
        <div class="section-break"></div>
      </div>


        %end
    </div>
        <div class="col-md-2">
            <div class="affix" data-spy="affix" data-offset-top="70" data-offset-bottom="200">
                <div>
                    %if use_dates:
                    <button onclick='useThreads()'>Use Threads</button>
                    %else:
                    <button onclick='useTime()'>Use Time</button>
                    %end
                    <button id='tablesbutton' onclick='showTablesClicked()'>Show Tables</button>
                </div>
                <br/>
                <div style="clear: left">
                    <label for="filter">Filter:</label>
                    <input type="search" name="filter" class="filter-input" value=""/>
                </div>
            </div>
        </div>
    </div>
    </div>
    </body>
</html>
%# vim: set ft=html:
