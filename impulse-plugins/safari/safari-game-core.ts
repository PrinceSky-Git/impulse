import {SafariPokemon, SafariPokemonGenerator} from './safari-pokemon-generator';
import {SafariRenderer} from './safari-renderer';

export interface SafariStoredMon {
	name: string;
	sprite: string;
}

export const safariStorage: Map<ID, SafariStoredMon[]> = new Map();

export class SafariGame {
	user: User;
	room: Room;
	balls: number;
	bait: number;
	rocks: number;
	currentPokemon: SafariPokemon | null;
	baitTurns: number;
	rockTurns: number;
	renderer: SafariRenderer;

	constructor(user: User, room: Room) {
		this.user = user;
		this.room = room;
		this.balls = 30;
		this.bait = 10;
		this.rocks = 10;
		this.currentPokemon = null;
		this.baitTurns = 0;
		this.rockTurns = 0;
		this.renderer = new SafariRenderer();
	}

	search() {
		if (this.balls <= 0) return 'You have no Safari Balls left!';
		this.currentPokemon = SafariPokemonGenerator.generate();
		this.baitTurns = 0;
		this.rockTurns = 0;
		return 'You search the tall grass...';
	}

	throwBall() {
		if (!this.currentPokemon) return 'There is no Pokémon here!';
		if (this.balls <= 0) return 'You are out of Safari Balls!';
		this.balls--;

		const mon = this.currentPokemon;

		let catchChance = 0.25;
		if (this.baitTurns > 0) catchChance *= 0.5;
		if (this.rockTurns > 0) catchChance *= 2;

		if (Math.random() < catchChance) {
			const monData: SafariStoredMon = {name: mon.name, sprite: mon.sprite};
			const id = this.user.id as ID;
			if (!safariStorage.has(id)) safariStorage.set(id, []);
			safariStorage.get(id)!.push(monData);

			this.currentPokemon = null;
			return 'Gotcha! ' + mon.name + ' was caught!';
		}

		let fleeChance = 0.1;
		if (this.baitTurns > 0) fleeChance *= 0.5;
		if (this.rockTurns > 0) fleeChance *= 2;

		if (Math.random() < fleeChance) {
			const name = mon.name;
			this.currentPokemon = null;
			return 'Oh no! ' + name + ' fled!';
		}

		if (this.baitTurns > 0) this.baitTurns--;
		if (this.rockTurns > 0) this.rockTurns--;

		return mon.name + ' broke free!';
	}

	throwBait() {
		if (!this.currentPokemon) return 'There is no Pokémon here!';
		if (this.bait <= 0) return 'You are out of bait!';
		this.bait--;

		this.baitTurns = 5;
		this.rockTurns = 0;

		return this.currentPokemon.name + ' is eating! It seems calmer.';
	}

	throwRock() {
		if (!this.currentPokemon) return 'There is no Pokémon here!';
		if (this.rocks <= 0) return 'You are out of rocks!';
		this.rocks--;

		this.rockTurns = 5;
		this.baitTurns = 0;

		return 'You threw a rock at ' + this.currentPokemon.name + '! It seems angry!';
	}

	run() {
		if (!this.currentPokemon) return 'There is no Pokémon to run from!';
		const name = this.currentPokemon.name;
		this.currentPokemon = null;
		return 'You ran away from ' + name + '.';
	}
}
