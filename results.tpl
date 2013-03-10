<!doctype html>
<html lang="us">
<head>
  <meta charset="utf-8">
    <title>MongoDB Performance Benchmarks</title>
    <link href="static/css/pepper-grinder/jquery-ui-1.10.1.custom.min.css" rel="stylesheet">
    <link href="static/css/style.css" rel="stylesheet">
    <link rel="stylesheet" href="static/css/page.css">
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
    <h1>MongoDB Benchmark Results</h1>
    % platforms = ' '.join(request.GET.getall('platforms'))
    % versions = ' '.join(request.GET.getall('versions'))
    % labels = ' '.join(request.GET.getall('labels'))
    % dates = ' '.join(request.GET.getall('dates'))
    % metric = request.GET.get('metric', 'ops_per_sec')
    % start = request.GET.get('start')
    % end = request.GET.get('end')
    % if start and end:
    % dates = start + " to " + end
    % end

    <form action="/details">
        <label for="metric">Metric</label>
        <select name="metric">
            %for m in ['ops_per_sec', 'time', 'speedup']:
            <option {{"selected" if m == metric else ""}}>{{m}}</option>
            %end
        </select>
        <br />

        <label for="labels">Labels (space-separated or /regex/)</label>
        <input type="text" name="labels" value="{{labels}}" />
        <br />

        <label for="platforms">Platforms (space-separated or /regex/)</label>
        <input type="text" name="platforms" value="{{platforms}}" />
        <br />

        <label for="versions">Versions (space-separated or /regex/)</label>
        <input type="text" name="versions" value="{{versions}}" />
        <br />

        <label for="dates">Dates (space-separated or /regex/)</label>
        <input type="text" name="dates" value="{{dates}}" />
        <br />
        <input type="submit" value="Go" />
    </form>
 
    %import urllib
    %for k, (outer_result, flot_data) in enumerate(zip(results, flot_results)):
    <h2>{{outer_result['name']}}</h2>

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
            %filtered = { key:result[key] for key in host_keys }
            %host = urllib.urlencode(filtered)
            <tr>
                <td>{{i}}</td>
                <td><a href="host?{{host}}">{{result['label']}}</a></td>
                <td>{{result['platform']}}</td>
                <td>{{result['version']}}</td>
                <td>{{result['date']}}</td>
                <td><a href="https://github.com/mongodb/mongo/commit/{{result['commit']}}">
                    {{result['commit'][:7]}}</a></td>
                %for thread in threads:
                <td>{{result.get(str(thread), {metric:'--'})[metric]}}</td>
                %end
            </tr>
            %end
        </thead>
    </table>

    <br />
    <div id="flot_{{k}}" style="width:600px;height:300px;"> </div>
    <div style="height:50px"> </div>

    <script>
        $(function(){
            var data = {{flot_data}};
            $.plot(
                $('#flot_{{k}}'), data,
                {
                   series: { lines: { show: true }, points: { show: true } },
                   xaxis: {ticks : {{threads}} },
                   yaxis: {min : 0},
                }
           );
       });
    </script>

    <hr>
    %end

</body>
</html>
 
%# vim: set ft=html: