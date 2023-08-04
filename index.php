<html>
<head>
    <style>
        body {
            background-color: #1e1e1e;
            color: #ffffff;
            font-family: Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
        }

        table {
            margin: 0 auto;
            width: 70%;
            border-collapse: collapse;
        }

        th, td {
            padding: 10px;
            text-align: left;
            vertical-align: top;
            border: 1px solid #333333;
        }

        th {
            background-color: #333333;
            color: #ffffff;
            font-weight: bold;
        }

        a {
            color: #ffffff;
        }

        img {
            width: 32px;
            height: 32px;
        }
    </style>
</head>
<body><h1>Userscripts</h1>
<table>
    <tr>
        <th>#</th>
        <th>Icon</th>
        <th>File Name</th>
        <th>Description</th>
        <th>Author</th>
        <th>Last Edit</th>
    </tr>
    <?php
    // Get the current directory path
    $dir_path = './';

    // Open the directory
    if ($handle = opendir($dir_path)) {

        // Initialize the HTML output variable
        $html = '';


        // Initialize the files array
        $files = [];

        // Loop through all the files in the directory
        while (false !== ($file = readdir($handle))) {

            // Ignore the "." and ".." directories and this PHP file itself
            if ($file != "." && $file != ".." && $file != basename(__FILE__) && strpos($file, '.user.js') !== false) {

                // Read the content of the line starting with "// @description", "// @author"
                // and "// @icon"
                $description = '';
                $author = '';
                $last_edit = '';
                $icon = '';
                $file_handle = fopen($file, 'r');
                if ($file_handle) {
                    while (($line = fgets($file_handle)) !== false) {
                        if (strpos($line, '// @description') === 0) {
                            $description = trim(substr($line, strlen('// @description')));
                        } else if (strpos($line, '// @author') === 0) {
                            $author = trim(substr($line, strlen('// @author')));
                        } else if (strpos($line, '// @icon') === 0) {
                            $icon = trim(substr($line, strlen('// @icon')));
                        }
                    }
                    fclose($file_handle);
                    $last_edit = date('Y-m-d H:i:s', filemtime($file));
                }

                // Add the file info to the files array
                $files[] = [
                    'icon' => $icon,
                    'filename' => $file,
                    'description' => $description,
                    'author' => $author,
                    'last_edit' => $last_edit,
                ];

                // Increment the file count
                $count++;
            }
        }

        // Close the directory
        closedir($handle);

        // Sort the files array by icon or filename
        usort($files, function ($a, $b) {
            return strcmp($a['icon'], $b['icon']); // Uncomment this line to sort by icon
            //return strcmp($a['filename'], $b['filename']); // Uncomment this line to sort by filename
        });
        // Add the sorted files to the HTML
        foreach ($files as $index => $file) {
            $html .= '<tr><td>' . ($index + 1) . '</td><td><img src="' . $file['icon'] . '"></td><td><a href="' . $file['filename'] . '">' . $file['filename'] . '</a></td><td>' . $file['description'] . '</td><td>' . $file['author'] . '</td><td>' . $file['last_edit'] . '</td></tr>';
        }


        // Output the HTML
        echo $html;
    }
    ?>
</table>
<div style="margin: 2em auto; width: 70%; color: #ffffff;">
    <h2>Was sind Userscripts?</h2>
    <p>
        Userscripts (Benutzerskripte) sind kleine Programme, die in Ihrem Webbrowser laufen, um die Funktionalität
        bestimmter Websites zu erweitern oder zu ändern. Sie können z. B. zusätzliche Funktionen hinzufügen, das
        Aussehen einer Website ändern oder sogar automatisierte Aktionen durchführen.
    </p>

    <h2>Wie installiert man Userscripts?</h2>
    <p>
        Die Installation von Userscripts ist recht einfach und erfordert nur wenige Schritte:
    </p>
    <ol>
        <li>Laden Sie zuerst einen Userscript-Manager für Ihren Browser herunter. Für Firefox ist das z. B.
            "Greasemonkey" und für Chrome "Tampermonkey".
        </li>
        <li>Nach der Installation des Userscript-Managers klicken Sie auf das Userscript, das Sie installieren
            möchten.
        </li>
        <li>Der Userscript-Manager öffnet dann eine neue Seite mit Details zum Skript und einer Option zur Installation.
            Klicken Sie auf "Installieren", um das Skript zu Ihrem Browser hinzuzufügen.
        </li>
    </ol>
    <p>
        Bitte beachten Sie, dass nicht alle Userscripts sicher sind. Installieren Sie nur Skripte von vertrauenswürdigen
        Quellen und lesen Sie immer das Skript durch, bevor Sie es installieren, um zu verstehen, was es tut.
    </p>
</div>

</body>
</html>