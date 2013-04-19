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
        <script type="text/javascript" src="static/js/jquery.flot.min.js"></script>
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
        % multidb = request.GET.get('multidb', '0')
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
        %for k, (outer_result, flot_data) in enumerate(zip(results, flot_results)):
        <h2 id="{{outer_result['name']}}"><a href="https://github.com/search?q={{outer_result['name'][outer_result['name'].rfind(":") + 1:]}}+path%3Abenchmark.cpp+repo%3Amongodb%2Fmongo-perf&amp;type=Code&amp;ref=searchresults" target="_blank">{{outer_result['name']}}</a></h2>
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
                    <td>{{result.get(str(thread), {metric:'--'})[metric]}}</td>
                    %end
                </tr>
                %end
            </tbody>
        </table>
        <br/>
        <div id="legendContainer_{{k}}" style="background-color:#fff;padding:2px;margin-bottom:8px;border-radius: 3px 3px 3px 3px;border:1px solid #E6E6E6;display:inline-block;margin:0 auto;width:600px;float:right"></div>
        <div id="flot_{{k}}" style="width:600px;height:300px;"></div>
        <div id="chart_{{k}}" data-dump="{{flot_data}}"></div>
        <div style="height:50px"></div>
        <script>
            $(function(){
                var data = $('#chart_{{k}}').data('dump');
                $.plot(
                    $('#flot_{{k}}'), data,
                    {
                        grid: { backgroundColor: { colors: ["#eceadf", "#d9d6c4"] } }, 
                        series: { lines: { show: true }, points: { show: true } },
                        legend: { show: true, position: "nw", backgroundOpacity: 0,
                        container: $("#legendContainer_{{k}}"), noColumns: 2 },
                        xaxis: {ticks : {{threads}} },
                        yaxis: {min : 0}
                    }
               );
            });
        </script>
        <hr>
        %end
    </body>
</html>
%# vim: set ft=html: