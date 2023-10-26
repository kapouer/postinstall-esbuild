class Me {
	#priv = 12;
	constructor() {
		this.#priv = 13;
	}
	set priv(val) {
		this.#priv = val;
	}
	get priv() {
		return this.#priv;
	}
}

const t = new Me();
t.priv = 24;
console.log(t.priv);
