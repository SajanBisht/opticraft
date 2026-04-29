

// goodLoop logic
function goodLoop() {
    for (let i = 0; i < 5; i++) {
        console.log(i);
    }
}

class Example {


// constructor logic
    constructor(public name: string) {}


// printName logic
    printName(): void {
        console.log(this.name);
    }

// sayHello logic
    sayHello(): void {
        console.log("Hello " + this.name);
    }
}