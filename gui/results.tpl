<!doctype html>
<html lang="us">
    <head>
        <meta charset="utf-8">
        <title>MongoDB Performance Benchmarks</title>
        <link href="static/css/jquery-ui-1.10.1.custom.min.css" rel="stylesheet">
        <link rel="stylesheet" href="static/css/page.css">
        <link href="static/css/perf_style.css" rel="stylesheet">
        <script type="text/javascript" src="static/js/jquery-1.9.1.min.js"></script>
        <script type="text/javascript" src="static/js/jquery-ui-1.10.1.custom.min.js"></script>
        <script type="text/javascript" src="static/js/perf_lib.js"></script>
        <script type="text/javascript" src="static/js/jquery.dataTables.min.js"></script>
        <script type="text/javascript" src="static/js/dygraph-combined.js"></script>
        <script>
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
        </script>
    </head>
    <body>
        <h1>MongoDB Benchmark Results (<a href="/">Home</a>)</h1>
        % platforms = ' '.join(request.GET.getall('platforms'))
        % versions = ' '.join(request.GET.getall('versions'))
        % labels = ' '.join(request.GET.getall('labels'))
        % dates = ' '.join(request.GET.getall('dates'))
        % home = ' '.join(request.GET.getall('home'))
        % metric = request.GET.get('metric', 'ops_per_sec')
        % multidb = request.GET.get('multidb', '0 1')
        % limit = request.GET.get('limit', '10')
        % start = request.GET.get('start', '')
        % end = request.GET.get('end', '')
        <form action="/results">
            <fieldset id="selectors" class="fields">
                <div>
                    <div>
                        <label for="metric">Metric</label>
                        <select id="metric" name="metric">
                        <option {{'selected' if metric=="ops_per_sec" else ""}}>ops_per_sec</option>
                        <option {{'selected' if metric=="time" else ""}}>time</option>
                        <option {{'selected' if metric=="speedup" else ""}}>speedup</option>
                        </select>
                    </div>
                    <div class="floatleft">
                        <label for="labels">Labels (space-separated or /regex/)</label>
                        <input type="text" name="labels" value="{{labels}}"/>
                    </div>
                    <div class="floatright">
                        <label for="platforms">Platforms (space-separated or /regex/)</label>
                        <input type="text" name="platforms" value="{{platforms}}"/>
                    </div>
                    <div class="floatleft">
                        <label for="multidb">Single/Muiti database (0 or 1)</label>
                        <input type="text" name="multidb" value="{{multidb}}"/>
                    </div>
                    <div class="floatright">
                        <label for="versions">Versions (space-separated or /regex/)</label>
                        <input type="text" name="versions" value="{{versions}}"/>
                    </div>
                    <div class="floatleft">
                        <label for="start">Start Date (YYYY-MM-DD)</label>
                        <input type="text" name="start" value="{{start}}"/>
                    </div>
                    <div class="floatright">
                        <label for="end">End Date (YYYY-MM-DD)</label>
                        <input type="text" name="end" value="{{end}}"/>
                    </div>
                    <div class="floatleft">
                        <label for="dates">Specific dates (space-separated or /regex/)</label>
                        <input type="text" name="dates" value="{{dates}}"/>
                    </div>
                    <div class="floatright">
                        <label for="limit">Limit</label>
                        <input type="text" name="limit" value="{{limit}}"/>
                    </div>
                </div>
                <input type="hidden" name="home" value="{{home}}"/>
                <input class="gofloat" type="submit" value="Go"/>
            </fieldset>
        </form>
        %import urllib
        %for k, (outer_result, dygraph_data) in enumerate(zip(results, dygraph_results)):
        <div class="test-entry">
        <h2 id="{{outer_result['name']}}"><a href="https://github.com/search?q={{outer_result['name'][outer_result['name'].rfind(":") + 1:]}}+repo%3Amongodb%2Fmongo-perf&amp;type=Code&amp;ref=searchresults" target="_blank">{{outer_result['name']}}</a></h2>
        <table class="display">
            <thead>
                <tr>
                    <th>Num</th>
                    <th>Label</th>
                    <th>Platform</th>
                    <th>Version</th>
                    <th>Date</th>
                    <th>Commit</th>
                    %for thread in threads:
                    <th>{{thread}} thread{{'' if thread == 1 else 's'}}</th>
                    %end
                </tr>
            </thead>
            <tbody>
                %for i, result in enumerate(outer_result['results']):
                %host_keys = ['date', 'label', 'version']
                %host = {}
                %for key in host_keys:
                %host[key] = result[key]
                %end
                %host = urllib.urlencode(host)
                <tr>
                    <td>{{i+1}}</td>
                    <td><a href="host?{{host}}">{{result['label']}}</a></td>
                    <td>{{result['platform']}}</td>
                    <td>{{result['version']}}</td>
                    <td>{{result['date']}}</td>
                    <td><a href="https://github.com/mongodb/mongo/commit/{{result['commit']}}" target="_blank">{{result['commit'][:7]}}</a></td>
                    %for thread in threads:
                    <td>{{"{0:.2f}".format(result.get(str(thread), {metric:'--'})[metric])}}</td>
                    %end
                </tr>
                %end
            </tbody>
        </table>
        <br/>
        <div class="dygraph-wrapper">
          <div id="graph_{{k}}" class="graph" style="width:600px;height:300px;"></div>
        </div>
        <script>
        function get_date_data(start_data) {
            var out_data = []
            for(var i = 0; i < start_data.length; i++) {
                var temp_list = []
                for(var j = 0; j < start_data[i].length; j++) {
                    if(j === 0) {
                        temp_list.push(new Date(start_data[i][j]))
                    } else {
                        temp_list.push(start_data[i][j])
                    }
                }
                out_data.push(temp_list)
            }
            return out_data
        }
        var date_data_{{k}} = get_date_data({{!dygraph_data['data']}});
        $("#graph-labels-{{k}}").ready(function(){
          var dygraph_{{k}} = new Dygraph(
            $('#graph_{{k}}')[0],
            date_data_{{k}},
            {
              labels: {{!dygraph_data['labels_json']}},
              strokeWidth: 3, //width of lines connecting data points
              colors: dycolors,
              labelsDiv: "graph-labels-{{k}}",
              includeZero: true, //ensure y-axis starts at 0
              xlabel: 'Run Date', //label for x-axis
              xRangePad: 5
            });
          dygraphs.push(dygraph_{{k}});

          //color label boxes properly
          $("#entry_{{k}} .chart-box").each(function(idx){
            $(this).css("background-color", dycolors[idx % dycolors.length]);
          });

        });

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
        <div class="section-break"></div>
      </div>
        %end
    </body>
</html>
%# vim: set ft=html:
