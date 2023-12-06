# Wails-htmx

An htmx extension to let you use htmx to talk to the Wails backend.

## Example index.html


```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8"/>
        <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
        <link rel="stylesheet" href="./src/style.css">
        <link rel="stylesheet" href="./src/app.css">
        <script src="https://unpkg.com/htmx.org@1.9.9"></script>
        <script src="./src/wails-htmx.js"></script>
        <script src="./src/main.js" type="module"></script>

        <title>wailshtmx</title>

    </head>
    <body hx-ext="wails">
        <h1>Wails HTMX</h1>
        <div id="app">
            <img id="logo" class="logo" src="src/assets/images/logo-universal.png"/>
            <div class="result" id="result">Please enter your name below 👇</div>
            <div class="input-box" id="input">
            <form wails-call="Greet" hx-swap="afterend">
                <input name="testdata" type="text" value="ssfsdfds"/>
                <input name="testdata2" type="hidden" value="ssfsdfds"/>
                <button type="submit">Clicky clicky</button>
            </form>
            </div>
        </div>
    </body>
</html>
```

And then change the example `Greet` method to be:

```go
type GreetValues struct {
	Testdata  string
	Testdata2 string
}

// Greet returns a greeting for the given name
func (a *App) Greet(names GreetValues) string {
	return fmt.Sprintf("Hello %s, It's show time!", names.Testdata)
}
```
