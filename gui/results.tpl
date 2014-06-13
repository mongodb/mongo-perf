<!doctype html>
<html lang="us">
    <head>
        <meta charset="utf-8">
        <title>MongoDB Performance Benchmarks</title>
        <link href="static/css/jquery-ui-1.10.1.custom.min.css" rel="stylesheet">
        <link rel="stylesheet" href="static/css/page.css">
        <link href="static/css/perf_style.css" rel="stylesheet">
        <link href="static/bootstrap-3.1.1-dist/css/bootstrap.min.css" rel="stylesheet">
        <script type="text/javascript" src="static/js/jquery-1.9.1.min.js"></script>
        <script type="text/javascript" src="static/js/jquery-ui-1.10.1.custom.min.js"></script>
        <script type="text/javascript" src="static/js/perf_lib.js"></script>
        <script type="text/javascript" src="static/js/jquery.dataTables.min.js"></script>
        <script type="text/javascript" src="static/js/dygraph-combined.js"></script>
        <script>
            reloadlist = []
            $(document).ready(function(){
                $('table').dataTable({
                        "bPaginate": false,
                        "bLengthChange": false,
                        "bFilter": false,
                        "bInfo": false,
                        "bAutoWidth": true
                    });
                });

            var dygraphs = [];
            var dycolors = ["#7BBADE", "#93DE7F", "#F29E4A", "#FF7050",
                            "#FFEC1E", "#0A79BD", "#00B215", "#BAA900",
                            "#A34A00", "#C21F00", "#222222", "#FF44EE",
                            "#FF5A00", "#AA66FF", "#3BCC75", "#29190F"];
            function dyToggle(graphIdx, seriesIdx, el) {
              dygraphs[graphIdx].setVisibility(seriesIdx, el.checked);
            }

            //TODO fix this to do it properly, its an ugly hack
            function useThreads() {
                var myurl = document.URL;
                myurl = myurl + '&xaxis=1'
                window.location.replace(myurl);
            }
            function useTime() {
                var myurl = document.URL;
                myurl = myurl + '&xaxis=0'
                window.location.replace(myurl);
            }

            function spreadDates() {
                var myurl = document.URL;
                myurl = myurl + '&spread=1'
                window.location.replace(myurl);
            }
            function dontSpreadDates() {
                var myurl = document.URL;
                myurl = myurl + '&spread=0'
                window.location.replace(myurl);
            }


            %if spread_dates:
            var even_spread = true;
            %else:
            var even_spread = false;
            %end

            function get_date_data(start_data) {
                var out_data = [];
                var spread_counter = 1;
                for(var i = 0; i < start_data.length; i++) {
                    var temp_list = []
                    for(var j = 0; j < start_data[i].length; j++) {
                        if(j === 0) {
                            if(even_spread) {
                                temp_list.push(spread_counter);
                                spread_counter += 1;
                            } else {
                                temp_list.push(new Date(start_data[i][j]))
                            }
                        } else {
                            temp_list.push(start_data[i][j])
                        }
                    }
                    out_data.push(temp_list)
                }
                return out_data
            }
        </script>
    </head>
    <div class="container">
    <body>
        <h1>MongoDB Benchmark Results (<a href="/">Home</a>)</h1>
        %if use_dates:
        <button onclick='useThreads()' >Use Threads</button>
        %else:
        <button onclick='useTime()' >Use Time</button>
        %end

        <br />
        %import urllib
        %for k, (outer_result, dygraph_data) in enumerate(zip(results, dygraph_results)):
        <div class="test-entry">
        <h2 id="{{outer_result['name']}}">{{outer_result['name']}}</h2>
        <table class="table table-striped">
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
                    <td>{{"{0:.2f}".format(result[str(thread)]["ops_per_sec"])}}</td>
                    %end
                </tr>
                %end
            </tbody>
        </table>
        <br/>
        <div class="container">
        <div class="dygraph-wrapper">
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
              xlabel: 'Run Date' //label for x-axis
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
    </body>
</html>
%# vim: set ft=html:
