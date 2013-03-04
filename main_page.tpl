<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd"> 
<html> 
<head> 
  <title>MongoDB Benchmark Results</title> 
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" > 
  <link rel="stylesheet" href="/static/css/page.css">

  <script src="static/jquery-1.3.2.min.js"></script>
  <script src="static/jquery.dataTables.min.js"></script>
  <script src="static/jquery.flot.min.js"></script>
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

    % metric = request.GET.get('metric', 'ops_per_sec')
    % versions = request.GET.get('versions', '')
    % date = request.GET.get('date', '')

    <form action="/">
        <label for="metric">Metric</label>
        <select name="metric">
            %for m in ['ops_per_sec', 'time', 'speedup']:
            <option {{"selected" if m == metric else ""}}>{{m}}</option>
            %end
        </select>
        <br />

        <label for="versions">Versions (space-separated or /regex/)</label>
        <input type="text" name="versions" value="{{versions}}" />
        <br />

        <label for="versions">Date (space-separated or /regex/)</label>
        <input type="text" name="date" value="{{date}}" />
        <br />

        <input type="submit" value="Go" />
    </form>
 
    %for k, (outer_result, flot_data) in enumerate(zip(results, flot_results)):
    <h2>{{outer_result['name']}}</h2>

    <table class="display">
        <thead>
            <tr>
                <th>Num</th>
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
            <tr>
                <td>{{i}}</td>
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